import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { coercePlan, DEFAULT_PLAN, BILLING_CCY, planPriceMinor, type PlanId } from "@/lib/plans";

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

export type BillingEventType =
  | "checkout_started"
  | "payment_success"
  | "payment_failed"
  | "canceled"
  /** The ledger and the entitlement disagree — money moved, the row did not. */
  | "ledger_error";

/**
 * Append a row to the billing_events audit log. Best-effort: logging must never
 * break the payment flow, so failures here are swallowed (the table may also not
 * exist yet if the migration hasn't been run).
 */
export async function logBillingEvent(args: {
  userId: string;
  eventType: BillingEventType;
  kind?: "initial" | "renewal" | null;
  plan?: PlanId | null;
  invoiceId?: string | null;
  amount?: number | null;
  ccy?: number | null;
  status?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    if (!supabase) return;
    await supabase.from("billing_events").insert({
      user_id: args.userId,
      event_type: args.eventType,
      kind: args.kind ?? null,
      plan: args.plan ?? null,
      invoice_id: args.invoiceId ?? null,
      amount: args.amount ?? null,
      ccy: args.ccy ?? null,
      status: args.status ?? null,
      detail: args.detail ?? null,
    });
  } catch {
    // best-effort
  }
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
 *
 * Writes the ledger first and only unlocks Clerk once that write is confirmed
 * to have touched a row. The two must not drift: Clerk is what the paywall
 * reads, but `getDueSubscriptions()` renews from this table, so a plan open in
 * Clerk with no row here is a customer who pays once and then uses the paid
 * tier forever — the exact "charged once and never again" symptom.
 *
 * An `UPDATE ... WHERE user_id = X` that matches nothing is not an error as far
 * as Supabase is concerned: it returns `error === null`. So this upserts and
 * checks that a row actually came back. Upsert rather than update because by
 * the time we get here the money has already moved — healing a missing row
 * serves the customer better than refusing to record the payment. The row is
 * normally created at checkout, but the invoice is created *before* that write
 * (see api/billing/checkout), so a failure in between leaves a payable invoice
 * with no ledger row behind it.
 */
export async function activateSubscription(args: {
  userId: string;
  plan: PlanId;
  invoiceId: string;
  cardToken?: string | null;
  maskedPan?: string | null;
  /** Whether this charge is the first payment or a monthly renewal. */
  kind?: "initial" | "renewal";
}): Promise<void> {
  const existing = await getSubscription(args.userId);
  const base =
    existing?.current_period_end && new Date(existing.current_period_end) > new Date()
      ? new Date(existing.current_period_end)
      : new Date();
  const periodEnd = addOneMonth(base).toISOString();
  const now = new Date().toISOString();
  const chargedAmount = args.plan === "free" ? 0 : planPriceMinor(args.plan);

  const row: Record<string, unknown> = {
    user_id: args.userId,
    plan: args.plan,
    status: "active",
    // Required on insert (NOT NULL, no default). On conflict these simply
    // restate the current plan's price, which is what was just charged.
    ccy: BILLING_CCY,
    amount: chargedAmount,
    wallet_id: args.userId,
    last_invoice_id: args.invoiceId,
    current_period_end: periodEnd,
    failed_charges: 0,
    updated_at: now,
  };
  // Only overwrite the stored token when we actually have a fresh one.
  // `auto_renew` is deliberately absent: omitted columns keep their existing
  // value on conflict, so this cannot silently re-enable a cancelled renewal.
  if (args.cardToken) row.card_token = args.cardToken;
  if (args.maskedPan) row.masked_pan = args.maskedPan;

  const { data, error } = await db()
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" })
    .select("user_id");

  const wrote = !error && (data?.length ?? 0) > 0;
  if (!wrote) {
    const detail = error
      ? error.message
      : "upsert reported no error but returned no row";
    // Loud on both channels: the event survives for the admin screen, the
    // console line survives even when billing_events itself is missing.
    console.error(
      `[billing] ledger write failed for ${args.userId} on invoice ${args.invoiceId}: ${detail}`,
    );
    await logBillingEvent({
      userId: args.userId,
      eventType: "ledger_error",
      kind: args.kind ?? "initial",
      plan: args.plan,
      invoiceId: args.invoiceId,
      amount: chargedAmount,
      ccy: BILLING_CCY,
      status: "error",
      detail,
    });
    // Deliberately before setClerkPlan: better a payment the webhook retries
    // than an entitlement no renewal sweep can ever see.
    throw new Error(`Could not record subscription for ${args.userId}: ${detail}`);
  }

  await setClerkPlan(args.userId, args.plan);

  // Single chokepoint for "money received" — logged exactly once per charge
  // (webhook initial payments and cron renewals both funnel through here, and
  // duplicate webhooks are filtered out before this is called).
  await logBillingEvent({
    userId: args.userId,
    eventType: "payment_success",
    kind: args.kind ?? "initial",
    plan: args.plan,
    invoiceId: args.invoiceId,
    amount: chargedAmount,
    ccy: BILLING_CCY,
    status: "success",
  });
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
