import { NextResponse } from "next/server";
import { PLANS, BILLING_CCY, planPriceMinor, type PlanId } from "@/lib/plans";
import { SITE_URL } from "@/lib/seo";
import { chargeWallet, isMonobankConfigured, listWalletCards } from "@/lib/server/monobank";
import {
  activateSubscription,
  attachCardToken,
  buildReference,
  getDueSubscriptions,
  getTokenlessSubscriptions,
  logBillingEvent,
  recordRenewalFailure,
} from "@/lib/server/subscriptions";

const HOUR_MS = 60 * 60 * 1000;

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
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
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

  for (const sub of due) {
    if (!sub.card_token) continue;
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
      results.push({ userId: sub.user_id, plan, outcome: "error" });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
    tokenSweep: { checked: tokenSweep.length, entries: tokenSweep },
  });
}
