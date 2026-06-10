import { NextResponse } from "next/server";
import { PLANS, BILLING_CCY, planPriceMinor, type PlanId } from "@/lib/plans";
import { SITE_URL } from "@/lib/seo";
import { chargeWallet, isMonobankConfigured } from "@/lib/server/monobank";
import {
  activateSubscription,
  buildReference,
  getDueSubscriptions,
  logBillingEvent,
  recordRenewalFailure,
} from "@/lib/server/subscriptions";

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

  return NextResponse.json({ ok: true, processed: results.length, results });
}
