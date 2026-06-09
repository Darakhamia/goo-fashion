import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { coercePlan, DEFAULT_PLAN, type PlanId } from "@/lib/plans";

/**
 * Subscription ledger backing monobank billing.
 *
 * The source of truth for *access* is Clerk publicMetadata.plan (see
 * require-plan.ts). This module keeps that in sync with the billing state in
 * Supabase and stores the tokenized card used for monthly auto-renewal.
 */

export type SubscriptionStatus = "pending" | "active" | "past_due" | "canceled";

export interface SubscriptionRow {
  user_id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  ccy: number;
  amount: number;
  card_token: string | null;
  masked_pan: string | null;
  wallet_id: string | null;
  last_invoice_id: string | null;
  current_period_end: string | null;
  auto_renew: boolean;
  failed_charges: number;
  created_at: string;
  updated_at: string;
}

function db() {
  if (!supabase) {
    throw new Error("Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return supabase;
}

/** Set the user's entitlement in Clerk so the paywall unlocks immediately. */
export async function setClerkPlan(userId: string, plan: PlanId): Promise<void> {
  const cc = await clerkClient();
  const user = await cc.users.getUser(userId);
  const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
  await cc.users.updateUserMetadata(userId, {
    publicMetadata: { ...meta, plan },
  });
}

/** Record an invoice we just created, before the customer has paid. */
export async function upsertPendingSubscription(args: {
  userId: string;
  plan: PlanId;
  amount: number;
  ccy: number;
  invoiceId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db()
    .from("subscriptions")
    .upsert(
      {
        user_id: args.userId,
        plan: args.plan,
        status: "pending",
        ccy: args.ccy,
        amount: args.amount,
        wallet_id: args.userId,
        last_invoice_id: args.invoiceId,
        auto_renew: true,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(error.message);
}

function addOneMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Mark a subscription active after a successful payment and unlock the plan in
 * Clerk. Extends the billing period by one month from the later of now / the
 * current period end (so an early renewal doesn't lose paid time).
 */
export async function activateSubscription(args: {
  userId: string;
  plan: PlanId;
  invoiceId: string;
  cardToken?: string | null;
  maskedPan?: string | null;
}): Promise<void> {
  const existing = await getSubscription(args.userId);
  const base =
    existing?.current_period_end && new Date(existing.current_period_end) > new Date()
      ? new Date(existing.current_period_end)
      : new Date();
  const periodEnd = addOneMonth(base).toISOString();
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    plan: args.plan,
    status: "active",
    last_invoice_id: args.invoiceId,
    current_period_end: periodEnd,
    failed_charges: 0,
    updated_at: now,
  };
  // Only overwrite the stored token when we actually have a fresh one.
  if (args.cardToken) update.card_token = args.cardToken;
  if (args.maskedPan) update.masked_pan = args.maskedPan;

  const { error } = await db()
    .from("subscriptions")
    .update(update)
    .eq("user_id", args.userId);
  if (error) throw new Error(error.message);

  await setClerkPlan(args.userId, args.plan);
}

export async function getSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await db()
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubscriptionRow) ?? null;
}

/** Active subscriptions whose paid period has ended — candidates for renewal. */
export async function getDueSubscriptions(now = new Date()): Promise<SubscriptionRow[]> {
  const { data, error } = await db()
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .eq("auto_renew", true)
    .lte("current_period_end", now.toISOString())
    .not("card_token", "is", null);
  if (error) throw new Error(error.message);
  return (data as SubscriptionRow[]) ?? [];
}

const MAX_FAILED_CHARGES = 3;

/**
 * Record a failed renewal charge. After too many consecutive failures we give
 * up, downgrade the user to free, and stop trying.
 */
export async function recordRenewalFailure(userId: string): Promise<void> {
  const sub = await getSubscription(userId);
  if (!sub) return;
  const failed = sub.failed_charges + 1;
  const downgrade = failed >= MAX_FAILED_CHARGES;

  const { error } = await db()
    .from("subscriptions")
    .update({
      failed_charges: failed,
      status: downgrade ? "canceled" : "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  if (downgrade) {
    await setClerkPlan(userId, DEFAULT_PLAN);
  }
}

/** Cancel auto-renewal (keeps access until the current period ends). */
export async function cancelAutoRenew(userId: string): Promise<void> {
  const { error } = await db()
    .from("subscriptions")
    .update({ auto_renew: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Parse the "<userId>|<plan>" reference we encode into invoices. */
export function parseReference(reference: string | undefined | null): { userId: string; plan: PlanId } | null {
  if (!reference) return null;
  const sep = reference.indexOf("|");
  if (sep < 0) return null;
  const userId = reference.slice(0, sep);
  const plan = coercePlan(reference.slice(sep + 1));
  if (!userId || plan === "free") return null;
  return { userId, plan };
}

export function buildReference(userId: string, plan: PlanId): string {
  return `${userId}|${plan}`;
}
