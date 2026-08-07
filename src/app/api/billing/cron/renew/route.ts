import { NextResponse } from "next/server";
import { PLANS, BILLING_CCY, planPriceMinor, type PlanId } from "@/lib/plans";
import { SITE_URL } from "@/lib/seo";
import { chargeWallet, isMonobankConfigured, listWalletCards } from "@/lib/server/monobank";
import {
  activateSubscription,
  attachCardToken,
  buildReference,
  countSubscriptionsByStatus,
  getDueSubscriptions,
  getEventsSince,
  getLastEventAt,
  getTokenlessSubscriptions,
  logBillingEvent,
  recordRenewalFailure,
} from "@/lib/server/subscriptions";
import { sendBillingAlert } from "@/lib/server/billing-alerts";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** The schedule is daily (see vercel.json), so a gap past this is a real miss. */
const CRON_GAP_ALERT_HOURS = 36;
/** Do not let a public 401 turn into an alert flood. */
const MISCONFIG_ALERT_COOLDOWN_MS = 12 * HOUR_MS;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Monthly auto-renewal sweep.
 *
 * Triggered by Vercel Cron (see vercel.json). For every active subscription
 * whose paid period has ended, charge the saved card via monobank's
 * merchant-initiated wallet payment. On success we extend the period (the
 * webhook also confirms, idempotently); on failure we record it and eventually
 * downgrade.
 *
 * Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` for scheduled
 * invocations (Cron Jobs hit the endpoint with GET). Manual calls must pass the
 * same header.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Vercel is calling this daily and getting 401 every time, so renewals have
    // silently stopped. Nothing else surfaces that — the schedule looks healthy
    // from the outside. Alert, but at most twice a day: this endpoint is public
    // and anyone hitting it would otherwise trigger mail.
    const lastAlert = await getLastEventAt("cron_misconfigured");
    if (!lastAlert || Date.now() - lastAlert.getTime() > MISCONFIG_ALERT_COOLDOWN_MS) {
      await logBillingEvent({
        userId: "system",
        eventType: "cron_misconfigured",
        status: "error",
        detail: "CRON_SECRET is not set — the renewal cron can only return 401",
      });
      await sendBillingAlert("Renewal cron cannot run: CRON_SECRET is not set", [
        "The daily renewal sweep rejects every call because CRON_SECRET is missing from the environment.",
        "Until it is set, no subscription is being charged and no one is being downgraded.",
        "Fix: add CRON_SECRET in the Vercel project settings (Production) and redeploy.",
      ]);
    }
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // How long since the last successful run. Read before writing this run's
  // heartbeat, or the answer is always "just now".
  const lastRunAt = await getLastEventAt("cron_run");
  const gapHours = lastRunAt ? Math.floor((Date.now() - lastRunAt.getTime()) / HOUR_MS) : null;
  if (!isMonobankConfigured) {
    return NextResponse.json({ error: "MONOBANK_TOKEN not configured." }, { status: 503 });
  }

  // ── Recover card tokens before charging anything ──────────────────────────
  // A subscription that activated without a token is invisible to
  // getDueSubscriptions() — it stays active and unbilled forever. monobank
  // tokenizes asynchronously, so a card missing at webhook time is usually in
  // the wallet by now. Retry here daily until it turns up.
  const tokenSweep: Array<{ userId: string; outcome: string; ageHours?: number }> = [];
  for (const sub of await getTokenlessSubscriptions()) {
    const ageHours = Math.floor((Date.now() - new Date(sub.created_at).getTime()) / HOUR_MS);
    try {
      const card = (await listWalletCards(sub.user_id))[0];
      if (!card) {
        await logBillingEvent({
          userId: sub.user_id,
          eventType: "card_token_missing",
          kind: "renewal",
          plan: sub.plan,
          // Past a day this has stopped being a timing quirk and is a
          // subscription that will never bill again — Б1-4 alerts on it.
          status: ageHours >= 24 ? "error" : "warning",
          detail: `still no saved card after ${ageHours}h`,
        });
        tokenSweep.push({ userId: sub.user_id, outcome: "still-missing", ageHours });
        continue;
      }
      await attachCardToken(sub.user_id, card.cardToken, card.maskedPan);
      await logBillingEvent({
        userId: sub.user_id,
        eventType: "card_token_recovered",
        kind: "renewal",
        plan: sub.plan,
        status: "success",
        detail: `recovered after ${ageHours}h`,
      });
      tokenSweep.push({ userId: sub.user_id, outcome: "recovered", ageHours });
    } catch (err) {
      await logBillingEvent({
        userId: sub.user_id,
        eventType: "card_token_missing",
        kind: "renewal",
        plan: sub.plan,
        status: "error",
        detail: err instanceof Error ? err.message : "wallet lookup failed",
      });
      tokenSweep.push({ userId: sub.user_id, outcome: "error", ageHours });
    }
  }

  // Read due subscriptions after the sweep so anything just recovered is
  // charged in this same run rather than waiting another day.
  const due = await getDueSubscriptions();
  const results: Array<{ userId: string; plan: PlanId; outcome: string }> = [];
  const failures: string[] = [];

  for (const sub of due) {
    if (!sub.card_token) {
      // getDueSubscriptions already filters these out, so reaching here means
      // the query and this loop disagree. It used to `continue` in silence,
      // which is how a subscription could stop renewing with nothing to show
      // for it. Leave a mark instead.
      await logBillingEvent({
        userId: sub.user_id,
        eventType: "renewal_skipped",
        kind: "renewal",
        plan: sub.plan,
        status: "warning",
        detail: "due for renewal but no card token on the row",
      });
      results.push({ userId: sub.user_id, plan: sub.plan, outcome: "skipped" });
      continue;
    }
    const plan = sub.plan as Exclude<PlanId, "free">;
    try {
      const charge = await chargeWallet({
        cardToken: sub.card_token,
        amount: planPriceMinor(plan),
        ccy: BILLING_CCY,
        reference: buildReference(sub.user_id, plan),
        destination: `Goo Fashion — ${PLANS[plan].name} (renewal)`,
        webHookUrl: `${SITE_URL}/api/billing/webhook`,
        initiationKind: "merchant",
      });

      if (charge.status === "success") {
        await activateSubscription({
          userId: sub.user_id,
          plan,
          invoiceId: charge.invoiceId,
          kind: "renewal",
        });
        results.push({ userId: sub.user_id, plan, outcome: "renewed" });
      } else if (
        charge.status === "failure" ||
        charge.status === "expired" ||
        charge.status === "reversed"
      ) {
        await recordRenewalFailure(sub.user_id);
        await logBillingEvent({
          userId: sub.user_id,
          eventType: "payment_failed",
          kind: "renewal",
          plan,
          invoiceId: charge.invoiceId,
          amount: planPriceMinor(plan),
          ccy: BILLING_CCY,
          status: charge.status,
          detail: charge.failureReason ?? null,
        });
        failures.push(`${sub.user_id} (${plan}): ${charge.status}${charge.failureReason ? ` — ${charge.failureReason}` : ""}`);
        results.push({ userId: sub.user_id, plan, outcome: "failed" });
      } else {
        // processing / hold — the webhook will resolve it.
        results.push({ userId: sub.user_id, plan, outcome: "pending" });
      }
    } catch (err) {
      await recordRenewalFailure(sub.user_id);
      await logBillingEvent({
        userId: sub.user_id,
        eventType: "payment_failed",
        kind: "renewal",
        plan,
        amount: planPriceMinor(plan),
        ccy: BILLING_CCY,
        detail: err instanceof Error ? err.message : "charge error",
      });
      failures.push(`${sub.user_id} (${plan}): ${err instanceof Error ? err.message : "charge error"}`);
      results.push({ userId: sub.user_id, plan, outcome: "error" });
    }
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  // Written on every run so the *absence* of recent rows is what says the
  // schedule stopped firing. A cron that never runs cannot report itself, so
  // this is read on the next run that does happen and by the admin screen.
  const renewed = results.filter((r) => r.outcome === "renewed").length;
  await logBillingEvent({
    userId: "system",
    eventType: "cron_run",
    status: "success",
    detail: `due=${due.length} renewed=${renewed} failed=${failures.length} tokenSweep=${tokenSweep.length}`,
  });

  const alerts: string[] = [];

  if (gapHours !== null && gapHours >= CRON_GAP_ALERT_HOURS) {
    alerts.push("cron-gap");
    await sendBillingAlert(`Renewal cron had a ${gapHours}h gap`, [
      `The last recorded run was ${gapHours} hours ago; the schedule is daily.`,
      "Renewals due in that window were not attempted until now.",
      "Check the Vercel cron logs for failed or skipped invocations.",
    ]);
  }

  if (due.length > 0 && renewed === 0) {
    alerts.push("no-renewals");
    await sendBillingAlert(`${due.length} subscription${due.length === 1 ? " was" : "s were"} due, none renewed`, [
      `${due.length} subscription(s) came up for renewal and not one was charged successfully.`,
      failures.length > 0
        ? `Failures: ${failures.join("; ")}`
        : "No charge reported an outright failure either — check monobank connectivity and the outcomes below.",
      `Outcomes: ${results.map((r) => `${r.userId}=${r.outcome}`).join(", ") || "none"}`,
    ]);
  } else if (failures.length > 0) {
    alerts.push("failed-charges");
    await sendBillingAlert(`${failures.length} renewal charge(s) failed`, [
      `${renewed} of ${due.length} due subscription(s) renewed.`,
      ...failures.map((f) => `Failed: ${f}`),
      "After three consecutive failures a subscription is downgraded to free.",
    ]);
  }

  const stillTokenless = tokenSweep.filter((t) => t.outcome !== "recovered" && (t.ageHours ?? 0) >= 24);
  if (stillTokenless.length > 0) {
    alerts.push("tokenless");
    await sendBillingAlert(`${stillTokenless.length} active subscription(s) have no saved card`, [
      "These are active, auto-renew is on, and there is no card token — the renewal sweep cannot see them.",
      "They are paid plans running for free until the card is recovered or the customer re-subscribes.",
      ...stillTokenless.map((t) => `${t.userId}: no card for ${t.ageHours}h`),
    ]);
  }

  // ── Weekly summary ────────────────────────────────────────────────────────
  // Monday's run doubles as the weekly report: one schedule, no second cron to
  // configure and forget.
  let weekly: Record<string, unknown> | null = null;
  if (new Date().getUTCDay() === 1) {
    const since = new Date(Date.now() - 7 * DAY_MS);
    const [events, statuses] = await Promise.all([
      getEventsSince(since),
      countSubscriptionsByStatus().catch(() => ({}) as Record<string, number>),
    ]);
    const count = (type: string) => events.filter((e) => e.event_type === type).length;
    const earnedMinor = events
      .filter((e) => e.event_type === "payment_success")
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);

    weekly = {
      active: statuses.active ?? 0,
      pastDue: statuses.past_due ?? 0,
      canceled: statuses.canceled ?? 0,
      renewals: events.filter((e) => e.event_type === "payment_success" && e.kind === "renewal").length,
      newPayments: events.filter((e) => e.event_type === "payment_success" && e.kind === "initial").length,
      failed: count("payment_failed"),
      earnedUah: Math.round(earnedMinor / 100),
    };

    await sendBillingAlert("Weekly billing summary", [
      `Active subscriptions: ${weekly.active} (past due ${weekly.pastDue}, canceled ${weekly.canceled})`,
      `Last 7 days — new payments: ${weekly.newPayments}, renewals: ${weekly.renewals}, failed: ${weekly.failed}`,
      `Collected: ${weekly.earnedUah} UAH`,
      count("ledger_error") > 0 ? `Ledger errors: ${count("ledger_error")} — money moved without a row.` : "No ledger errors.",
      count("card_token_missing") > 0 ? `Card-token warnings: ${count("card_token_missing")}` : "No card-token problems.",
    ]);
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
    tokenSweep: { checked: tokenSweep.length, entries: tokenSweep },
    gapHours,
    alerts,
    weekly,
  });
}
