import crypto from "node:crypto";
import { supabase } from "@/lib/supabase";
import { BILLING_CCY, coercePlan, type PlanId } from "@/lib/plans";
import { SITE_URL } from "@/lib/seo";
import {
  cancelSubscription,
  createSubscription,
  getSubscriptionStatus,
  isSubscriptionRefused,
  listSubscriptionPayments,
  MonobankError,
  removeSubscription,
  type SubscriptionPayment,
  type SubscriptionStatusResult,
} from "@/lib/server/monobank";
import { downgradeIfOnPlan, logBillingEvent, setClerkPlan } from "@/lib/server/subscriptions";
import { coerceInterval, type BillingInterval } from "@/lib/server/billing-terms";
import { sendBillingAlert } from "@/lib/server/billing-alerts";

/**
 * Plans paid through monobank's own subscription (migration 028).
 *
 * The bank charges the card every month by itself and knocks on our chargeUrl
 * or statusUrl. Its notification body is not documented — no fields, no
 * signature — so it is never read: a knock only means "time to ask". We ask
 * the bank for the subscription's charges and state with our own token and
 * act on that. The same sync runs hourly from the cron, because knocks get
 * lost, and when the customer comes back from the payment page.
 *
 * A charge is recorded and the paid period extended by one database function
 * (goo_record_mono_charge), keyed by subscription + moment of the charge, so a
 * repeated knock or an overlapping sync cannot count the same money twice.
 */

/** monobank's interval format: one month. */
export const MONO_SUB_INTERVAL: BillingInterval = "1m";

const HOUR_MS = 60 * 60 * 1000;
/** A payment page the customer never paid is invalidated at the bank after this. */
const UNPAID_TTL_MS = 48 * HOUR_MS;
/** The customer-triggered sync does not ask the bank about one subscription more often than this. */
const MIN_RESYNC_MS = 15_000;

type PaidPlanId = Exclude<PlanId, "free">;

export type MonoSubscriptionStatus = "creating" | "created" | "active" | "cancelled" | "expired" | "failed";

export interface MonoSubscriptionRow {
  id: number;
  user_id: string;
  hook_hash: string;
  subscription_id: string | null;
  plan: string;
  amount: number;
  ccy: number;
  interval: string;
  status: MonoSubscriptionStatus;
  next_charge_at: string | null;
  cancelled_at: string | null;
  detail: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

function db() {
  if (!supabase) {
    throw new Error("Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return supabase;
}

/** The table or column from migration 028 is not there. */
function isMissingSchema(error: { code?: string }): boolean {
  return ["42P01", "PGRST205", "42703", "PGRST204"].includes(error.code ?? "");
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function hashHookSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

async function patchRow(id: number, patch: Partial<MonoSubscriptionRow>): Promise<void> {
  const { error } = await db()
    .from("mono_subscriptions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Checkout ─────────────────────────────────────────────────────────────────

export type StartResult =
  | { kind: "started"; subscriptionId: string; pageUrl: string }
  /** The bank does not open subscriptions to this merchant — use an invoice. */
  | { kind: "refused"; reason: string }
  /** Migration 028 is not applied — use an invoice. */
  | { kind: "unavailable"; reason: string };

/**
 * Ask monobank for a monthly subscription — daily for the goo-studio test —
 * and return its payment page.
 *
 * The secret that identifies the subscriber in the webhook URLs is stored (as
 * its hash) before the bank is called: the first knock can come right after
 * the customer pays, and it must find the row.
 */
export async function startBankSubscription(args: {
  userId: string;
  plan: PaidPlanId;
  amount: number;
  /** '1d' only for the goo-studio test subscription. */
  interval?: BillingInterval;
}): Promise<StartResult> {
  const interval = args.interval ?? MONO_SUB_INTERVAL;
  const secret = crypto.randomBytes(24).toString("hex");
  const { data, error } = await db()
    .from("mono_subscriptions")
    .insert({
      user_id: args.userId,
      hook_hash: hashHookSecret(secret),
      plan: args.plan,
      amount: args.amount,
      ccy: BILLING_CCY,
      interval,
      status: "creating",
    })
    .select("id")
    .single();
  if (error) {
    if (isMissingSchema(error)) return { kind: "unavailable", reason: error.message };
    throw new Error(error.message);
  }
  const rowId = (data as { id: number }).id;

  let created: { subscriptionId: string; pageUrl: string };
  try {
    created = await createSubscription({
      amount: args.amount,
      ccy: BILLING_CCY,
      interval,
      redirectUrl: `${SITE_URL}/subscribe?plan=${args.plan}&status=return`,
      chargeUrl: `${SITE_URL}/api/billing/subscription/${secret}/charge`,
      statusUrl: `${SITE_URL}/api/billing/subscription/${secret}/status`,
    });
  } catch (err) {
    await patchRow(rowId, { status: "failed", detail: errMsg(err) }).catch((e) =>
      console.error(`[billing] could not mark monobank subscription row ${rowId} failed: ${errMsg(e)}`),
    );
    if (isSubscriptionRefused(err)) return { kind: "refused", reason: errMsg(err) };
    throw err;
  }

  try {
    await patchRow(rowId, { subscription_id: created.subscriptionId, status: "created" });
  } catch (err) {
    // The bank has a subscription we could not tie to anyone. Left alone, it
    // would charge a customer we never find — take it back at once.
    console.error(`[billing] monobank subscription ${created.subscriptionId} not recorded: ${errMsg(err)}`);
    try {
      await removeSubscription(created.subscriptionId);
    } catch (removeErr) {
      await sendBillingAlert("monobank subscription created but not recorded", [
        `Subscription ${created.subscriptionId} for user ${args.userId} (${args.plan}) exists at monobank but not in our database.`,
        `Recording failed: ${errMsg(err)}. Invalidating it failed too: ${errMsg(removeErr)}.`,
        "If the customer pays, the bank will charge them with nothing on our side. Cancel it in the monobank business cabinet.",
      ]);
    }
    throw err;
  }

  await logBillingEvent({
    userId: args.userId,
    eventType: "checkout_started",
    kind: "initial",
    plan: args.plan,
    invoiceId: created.subscriptionId,
    amount: args.amount,
    ccy: BILLING_CCY,
    detail: "monobank subscription",
  });
  return { kind: "started", subscriptionId: created.subscriptionId, pageUrl: created.pageUrl };
}

// ── Lookups ──────────────────────────────────────────────────────────────────

/** The subscription a webhook URL's secret belongs to. Null for an unknown one. */
export async function findByHookSecret(secret: string): Promise<MonoSubscriptionRow | null> {
  const { data, error } = await db()
    .from("mono_subscriptions")
    .select("*")
    .eq("hook_hash", hashHookSecret(secret))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MonoSubscriptionRow) ?? null;
}

/** Subscriptions still waiting for payment or being charged. Empty before migration 028. */
async function liveRows(userId?: string): Promise<MonoSubscriptionRow[]> {
  let q = db().from("mono_subscriptions").select("*").in("status", ["created", "active"]);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) {
    if (isMissingSchema(error)) return [];
    throw new Error(error.message);
  }
  return (data as MonoSubscriptionRow[]) ?? [];
}

// ── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncOutcome {
  subscriptionId: string | null;
  userId: string;
  granted: number;
  failed: number;
  status: MonoSubscriptionStatus;
}

/** "success" pays; these are final failures; anything else is not settled yet and is left for the next sync. */
const FAILED_CHARGE = new Set(["failure", "failed", "declined", "reversed", "expired"]);

/**
 * Bring one subscription in line with the bank: record every charge we have
 * not seen, then its state. Charges go first — a subscription the bank has
 * just cancelled can still carry a last charge we have not recorded.
 */
export async function syncMonoSubscription(row: MonoSubscriptionRow): Promise<SyncOutcome> {
  const outcome: SyncOutcome = {
    subscriptionId: row.subscription_id,
    userId: row.user_id,
    granted: 0,
    failed: 0,
    status: row.status,
  };
  const subscriptionId = row.subscription_id;
  if (!subscriptionId) return outcome;
  const plan = coercePlan(row.plan);

  // A day of slack before the row was written covers clocks that disagree.
  const since = new Date(new Date(row.created_at).getTime() - 24 * HOUR_MS);
  let payments: SubscriptionPayment[] = [];
  try {
    payments = await listSubscriptionPayments(subscriptionId, since);
  } catch (err) {
    // An unpaid subscription may not be known to the payments call yet; it
    // still has to reach the expiry check below.
    if (!(err instanceof MonobankError && err.status === 404)) throw err;
  }
  payments.sort((a, b) => Date.parse(a.chargedAt) - Date.parse(b.chargedAt));

  for (const p of payments) {
    const settled = p.status === "success" ? "success" : FAILED_CHARGE.has(p.status) ? "failed" : null;
    const chargedAt = new Date(p.chargedAt);
    if (!settled || Number.isNaN(chargedAt.getTime())) continue;

    // The frozen terms, not today's price: the bank charges what the customer
    // agreed to, and less than that, or another currency, is not a payment.
    const termsOk = p.ccy === row.ccy && p.amount >= row.amount;
    const { data: result, error } = await db().rpc("goo_record_mono_charge", {
      p_subscription_id: subscriptionId,
      p_charged_at: chargedAt.toISOString(),
      p_amount: p.amount,
      p_ccy: p.ccy,
      p_status: p.status,
      p_grant: settled === "success" && termsOk,
    });
    if (error) throw new Error(`goo_record_mono_charge failed for ${subscriptionId}: ${error.message}`);

    switch (result as string) {
      case "granted_initial":
      case "granted_renewal": {
        const kind = result === "granted_initial" ? "initial" : "renewal";
        outcome.granted++;
        outcome.status = "active";
        await grantPlan(row, plan, kind, p);
        break;
      }
      case "granted_late":
        // Charged before we cancelled this subscription, seen only now. The
        // money paid for time, but the plan belongs to whatever replaced it.
        outcome.granted++;
        await logBillingEvent({
          userId: row.user_id,
          eventType: "payment_success",
          kind: "renewal",
          plan,
          invoiceId: subscriptionId,
          amount: p.amount,
          ccy: p.ccy,
          status: "success",
          detail: "monobank subscription, charged before it was cancelled",
        });
        break;
      case "recorded":
        if (settled === "success") {
          // Paid, but not the terms we froze — a person decides.
          await logBillingEvent({
            userId: row.user_id,
            eventType: "ledger_error",
            plan,
            invoiceId: subscriptionId,
            amount: p.amount,
            ccy: p.ccy,
            status: "error",
            detail: `monobank charged ${p.amount} (ccy ${p.ccy}), subscription terms are ${row.amount} (ccy ${row.ccy}); plan not extended`,
          });
          await sendBillingAlert("monobank subscription charged an unexpected amount", [
            `User ${row.user_id}, subscription ${subscriptionId} (${plan}).`,
            `Charged ${p.amount / 100} (ccy ${p.ccy}) at ${p.chargedAt}; the subscription was created for ${row.amount / 100} (ccy ${row.ccy}).`,
            "The paid period was not extended. Check the charge in the monobank business cabinet.",
          ]);
        } else {
          outcome.failed++;
          await logBillingEvent({
            userId: row.user_id,
            eventType: "payment_failed",
            kind: outcome.status === "created" ? "initial" : "renewal",
            plan,
            invoiceId: subscriptionId,
            amount: p.amount,
            ccy: p.ccy,
            status: p.status,
            detail: "monobank subscription charge",
          });
          await sendBillingAlert("monobank subscription charge failed", [
            `User ${row.user_id}, subscription ${subscriptionId} (${plan}) — monobank reports "${p.status}" at ${p.chargedAt}.`,
            "The bank decides whether to retry or cancel the subscription; a cancellation shows up on the next sync.",
          ]);
        }
        break;
      case "after_cancel":
        await logBillingEvent({
          userId: row.user_id,
          eventType: "ledger_error",
          plan,
          invoiceId: subscriptionId,
          amount: p.amount,
          ccy: p.ccy,
          status: "error",
          detail: `charged at ${p.chargedAt}, after the subscription was cancelled; plan not extended`,
        });
        await sendBillingAlert("monobank charged a cancelled subscription", [
          `User ${row.user_id}, subscription ${subscriptionId} (${plan}): ${p.amount / 100} UAH at ${p.chargedAt}.`,
          `We cancelled it at ${row.cancelled_at ?? "an unknown time"}. The plan was not extended.`,
          "Decide whether to refund the charge in the monobank business cabinet.",
        ]);
        break;
      // "duplicate": seen before, nothing to do.
    }
  }

  let state: SubscriptionStatusResult | null = null;
  try {
    state = await getSubscriptionStatus(subscriptionId);
  } catch (err) {
    // An unpaid subscription may not be known to the status call yet.
    if (!(err instanceof MonobankError && err.status === 404)) throw err;
  }

  const now = new Date();
  const patch: Partial<MonoSubscriptionRow> = { last_synced_at: now.toISOString() };
  if (state?.nextChargeDate) patch.next_charge_at = state.nextChargeDate;

  if (state?.status === "cancelled" && outcome.status === "created") {
    // Never paid, and the bank has closed it: nothing to end.
    patch.status = "expired";
    patch.detail = state.cancellationDesc ?? "cancelled at monobank before the first payment";
    outcome.status = "expired";
    await patchRow(row.id, patch);
    return outcome;
  }
  if (state?.status === "cancelled" && outcome.status === "active") {
    patch.status = "cancelled";
    patch.cancelled_at = state.endDate ?? now.toISOString();
    patch.detail = state.cancellationDesc ?? null;
    outcome.status = "cancelled";
    await patchRow(row.id, patch);
    await endRenewal(row.user_id, subscriptionId);
    await logBillingEvent({
      userId: row.user_id,
      eventType: "canceled",
      plan,
      invoiceId: subscriptionId,
      status: "cancelled",
      detail: `cancelled at monobank${state.cancellationDesc ? `: ${state.cancellationDesc}` : ""}`,
    });
    // We did not ask for this one: the customer or the bank (after a failed
    // charge) stopped it. The plan runs to the end of the paid period.
    await sendBillingAlert("monobank subscription cancelled", [
      `User ${row.user_id}, subscription ${subscriptionId} (${plan}) is cancelled at monobank.`,
      state.cancellationDesc ? `Reason given: ${state.cancellationDesc}` : "No reason given.",
      "The plan stays until the paid period ends, then returns to free.",
    ]);
    return outcome;
  }

  if (outcome.status === "created" && now.getTime() - Date.parse(row.created_at) > UNPAID_TTL_MS) {
    // A payment page nobody paid. Invalidated so it can never start charging
    // later, out of sight.
    try {
      await removeSubscription(subscriptionId);
    } catch (err) {
      if (!(err instanceof MonobankError && err.status === 404)) throw err;
    }
    patch.status = "expired";
    patch.detail = "not paid within 48 h";
    outcome.status = "expired";
  }

  await patchRow(row.id, patch);
  return outcome;
}

/** A charge moved the paid period: switch the plan on in Clerk and log the money. */
async function grantPlan(
  row: MonoSubscriptionRow,
  plan: PlanId,
  kind: "initial" | "renewal",
  p: SubscriptionPayment,
): Promise<void> {
  const subscriptionId = row.subscription_id!;
  await markRowInterval(row.user_id, subscriptionId, coerceInterval(row.interval));
  try {
    await setClerkPlan(row.user_id, plan);
  } catch (err) {
    // The period is already extended in the ledger and a repeat knock is a
    // duplicate, so nothing will retry this. A person has to.
    await logBillingEvent({
      userId: row.user_id,
      eventType: "ledger_error",
      kind,
      plan,
      invoiceId: subscriptionId,
      amount: p.amount,
      ccy: p.ccy,
      status: "error",
      detail: `paid, but the plan was not switched on in Clerk: ${errMsg(err)}`,
    });
    await sendBillingAlert("Paid subscription not switched on", [
      `User ${row.user_id} paid ${p.amount / 100} UAH for ${plan} (monobank subscription ${subscriptionId}).`,
      `Setting the plan in Clerk failed: ${errMsg(err)}`,
      "Set the plan by hand in goo-studio → Users.",
    ]);
  }

  await logBillingEvent({
    userId: row.user_id,
    eventType: "payment_success",
    kind,
    plan,
    invoiceId: subscriptionId,
    amount: p.amount,
    ccy: p.ccy,
    status: "success",
    detail: "monobank subscription",
  });

  if (kind === "initial") {
    // A plan change is a new subscription; the one it replaces must stop now,
    // or the customer pays for both.
    try {
      await stopBankSubscriptions(row.user_id, { except: subscriptionId });
    } catch (err) {
      await sendBillingAlert("Previous monobank subscription not cancelled", [
        `User ${row.user_id} started subscription ${subscriptionId} (${plan}), but cancelling their earlier one failed: ${errMsg(err)}`,
        "Until it is cancelled the customer is charged twice. Cancel it in the monobank business cabinet.",
      ]);
    }
  }
}

/**
 * goo_record_mono_charge writes the plan row without its billing_interval
 * (migration 029 came later), so the row would keep whatever period it had
 * before — a test's '1d' under a real monthly plan, say. Only goo-studio reads
 * it for a plan on a bank subscription, and only to show the period, so a
 * failure is logged, not raised: the payment is already recorded.
 */
async function markRowInterval(userId: string, subscriptionId: string, interval: BillingInterval): Promise<void> {
  const { error } = await db()
    .from("subscriptions")
    .update({ billing_interval: interval })
    .eq("user_id", userId)
    .eq("mono_subscription_id", subscriptionId);
  if (error && !isMissingSchema(error)) {
    console.error(`[billing] could not record the period of ${subscriptionId} for ${userId}: ${error.message}`);
  }
}

/** The plan row stops renewing if it runs on this subscription. */
async function endRenewal(userId: string, subscriptionId: string): Promise<void> {
  const { error } = await db()
    .from("subscriptions")
    .update({ auto_renew: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("mono_subscription_id", subscriptionId);
  if (error) throw new Error(error.message);
}

// ── Cancel ───────────────────────────────────────────────────────────────────

/**
 * Stop every monobank subscription of a user (but `except`): cancel the paid
 * ones, invalidate the unpaid ones. A subscription counts as stopped only
 * after the bank says so; the first refusal throws. Returns how many stopped.
 */
export async function stopBankSubscriptions(userId: string, opts: { except?: string } = {}): Promise<number> {
  let stopped = 0;
  for (const row of await liveRows(userId)) {
    if (!row.subscription_id || row.subscription_id === opts.except) continue;
    const now = new Date().toISOString();
    if (row.status === "active") {
      await cancelSubscription(row.subscription_id);
      await patchRow(row.id, { status: "cancelled", cancelled_at: now, detail: "cancelled by us" });
      await endRenewal(userId, row.subscription_id);
    } else {
      try {
        await removeSubscription(row.subscription_id);
      } catch (err) {
        if (!(err instanceof MonobankError && err.status === 404)) throw err;
      }
      await patchRow(row.id, { status: "expired", detail: "invalidated by us" });
    }
    stopped++;
  }
  return stopped;
}

// ── Sweeps ───────────────────────────────────────────────────────────────────

/** The customer is back from the payment page: sync their subscriptions now rather than wait for a knock. */
export async function syncUserBankSubscriptions(userId: string): Promise<SyncOutcome[]> {
  const out: SyncOutcome[] = [];
  for (const row of await liveRows(userId)) {
    if (row.last_synced_at && Date.now() - Date.parse(row.last_synced_at) < MIN_RESYNC_MS) continue;
    out.push(await syncMonoSubscription(row));
  }
  return out;
}

/**
 * The hourly reconciliation: every live subscription is synced (knocks get
 * lost), then plans whose subscription was cancelled and whose paid period has
 * ended go back to free.
 */
export async function syncAllBankSubscriptions(): Promise<{
  synced: SyncOutcome[];
  errors: Array<{ subscriptionId: string | null; userId: string; error: string }>;
  lapsed: Array<{ userId: string; plan: string; downgraded: boolean }>;
}> {
  const synced: SyncOutcome[] = [];
  const errors: Array<{ subscriptionId: string | null; userId: string; error: string }> = [];
  for (const row of await liveRows()) {
    try {
      synced.push(await syncMonoSubscription(row));
    } catch (err) {
      console.error(`[billing] monobank subscription sync failed for ${row.subscription_id}: ${errMsg(err)}`);
      errors.push({ subscriptionId: row.subscription_id, userId: row.user_id, error: errMsg(err) });
    }
  }
  const lapsed = await expireLapsedBankPlans();
  return { synced, errors, lapsed };
}

/**
 * Plans on a monobank subscription that will not renew (cancelled by the
 * customer, by us or by the bank) end when the paid period does. Only these:
 * rows on the old invoice + card road keep their documented behaviour
 * (BILLING.md, "Known gaps").
 */
async function expireLapsedBankPlans(now = new Date()): Promise<Array<{ userId: string; plan: string; downgraded: boolean }>> {
  const { data, error } = await db()
    .from("subscriptions")
    .select("user_id, plan, mono_subscription_id")
    .eq("status", "active")
    .eq("auto_renew", false)
    .not("mono_subscription_id", "is", null)
    .lt("current_period_end", now.toISOString());
  if (error) {
    if (isMissingSchema(error)) return [];
    throw new Error(error.message);
  }
  const out: Array<{ userId: string; plan: string; downgraded: boolean }> = [];
  for (const row of (data ?? []) as Array<{ user_id: string; plan: string; mono_subscription_id: string }>) {
    const { data: updated, error: updError } = await db()
      .from("subscriptions")
      .update({ status: "canceled", updated_at: now.toISOString() })
      .eq("user_id", row.user_id)
      .eq("status", "active")
      .select("user_id");
    if (updError) throw new Error(updError.message);
    if (!updated?.length) continue; // changed under us — a new payment, most likely
    const plan = coercePlan(row.plan);
    let downgraded = false;
    try {
      downgraded = await downgradeIfOnPlan(row.user_id, plan);
    } catch (err) {
      await sendBillingAlert("Ended subscription not downgraded", [
        `User ${row.user_id}: the ${plan} plan ended (monobank subscription ${row.mono_subscription_id} cancelled), but resetting Clerk to free failed: ${errMsg(err)}`,
        "Set the plan by hand in goo-studio → Users.",
      ]);
    }
    await logBillingEvent({
      userId: row.user_id,
      eventType: "canceled",
      plan,
      invoiceId: row.mono_subscription_id,
      status: "ended",
      detail: downgraded
        ? "paid period ended after cancellation; plan set to free"
        : "paid period ended after cancellation; Clerk plan left as is (set by hand, or the reset failed)",
    });
    out.push({ userId: row.user_id, plan, downgraded });
  }
  return out;
}
