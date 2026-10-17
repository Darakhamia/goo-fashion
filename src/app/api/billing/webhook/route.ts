import { NextResponse } from "next/server";
import { verifyWebhookSignature, type WebhookPayload } from "@/lib/server/monobank";
import { applyInvoicePaid } from "@/lib/server/invoice-payments";
import {
  getSubscription,
  logBillingEvent,
  parseReference,
  recordRenewalFailure,
} from "@/lib/server/subscriptions";
import { sendBillingAlert } from "@/lib/server/billing-alerts";

/**
 * monobank acquiring webhook — for invoices (road 2) and saved-card renewal
 * charges (road 3). Bank-side subscriptions knock on their own URL instead:
 * api/billing/subscription/[secret]/[event].
 *
 * monobank POSTs here whenever an invoice changes status, signing the raw body
 * with ECDSA (X-Sign header). We verify the signature, then act on terminal
 * states: "success" unlocks the plan, "failure"/"expired"/"reversed" on a
 * renewal counts as a failed charge.
 *
 * The invoice `reference` carries "<userId>|<plan>" (plus "|1d" for the
 * goo-studio test subscription), so this handler serves both the initial
 * checkout and unattended renewal charges.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const xSign = req.headers.get("x-sign");

  let valid = false;
  try {
    valid = await verifyWebhookSignature(rawBody, xSign);
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  const parsed = parseReference(payload.reference);
  if (!parsed) {
    // Not a subscription invoice we recognize — ack so monobank stops retrying.
    return NextResponse.json({ ok: true, ignored: true });
  }
  const { userId, plan, interval } = parsed;

  try {
    if (payload.status === "success") {
      const applied = await applyInvoicePaid({ userId, plan, invoiceId: payload.invoiceId, interval });
      return applied.duplicate
        ? NextResponse.json({ ok: true, duplicate: true })
        : NextResponse.json({ ok: true, cardToken: applied.cardToken });
    }

    if (
      payload.status === "failure" ||
      payload.status === "expired" ||
      payload.status === "reversed"
    ) {
      const existing = await getSubscription(userId);
      // Only treat as a renewal failure if this user already had an active sub;
      // a failed *first* payment just leaves the pending row untouched.
      const failedRenewal = !!existing && (existing.status === "active" || existing.status === "past_due");
      if (failedRenewal) {
        await recordRenewalFailure(userId);
      }
      await logBillingEvent({
        userId,
        eventType: "payment_failed",
        kind: failedRenewal ? "renewal" : "initial",
        plan,
        invoiceId: payload.invoiceId,
        amount: payload.amount,
        ccy: payload.ccy,
        status: payload.status,
        detail: payload.failureReason ?? null,
      });
      await sendBillingAlert(
        failedRenewal ? "Renewal payment failed" : "First payment failed",
        [
          `User ${userId} on the ${plan} plan — monobank reported "${payload.status}".`,
          payload.failureReason ? `Reason: ${payload.failureReason}` : "No failure reason given.",
          `Invoice ${payload.invoiceId}, ${Math.round((payload.amount ?? 0) / 100)} UAH.`,
          failedRenewal
            ? "Three consecutive failures downgrade the subscription to free."
            : "This was a first payment, so no subscription was active to lose.",
        ],
      );
      return NextResponse.json({ ok: true });
    }

    // created / processing / hold — nothing to do yet.
    return NextResponse.json({ ok: true, pending: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook handling failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
