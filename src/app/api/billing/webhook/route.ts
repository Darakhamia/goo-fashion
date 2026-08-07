import { NextResponse } from "next/server";
import {
  listWalletCards,
  verifyWebhookSignature,
  type WebhookPayload,
} from "@/lib/server/monobank";
import {
  activateSubscription,
  getSubscription,
  logBillingEvent,
  parseReference,
  recordRenewalFailure,
} from "@/lib/server/subscriptions";
import { sendBillingAlert } from "@/lib/server/billing-alerts";

/**
 * monobank acquiring webhook.
 *
 * monobank POSTs here whenever an invoice changes status, signing the raw body
 * with ECDSA (X-Sign header). We verify the signature, then act on terminal
 * states: "success" unlocks the plan, "failure"/"expired"/"reversed" on a
 * renewal counts as a failed charge.
 *
 * The invoice `reference` carries "<userId>|<plan>", so this handler serves
 * both the initial checkout and unattended renewal charges.
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
  const { userId, plan } = parsed;

  try {
    if (payload.status === "success") {
      // Idempotency: ignore duplicate success callbacks for the same invoice.
      const existing = await getSubscription(userId);
      if (
        existing &&
        existing.status === "active" &&
        existing.last_invoice_id === payload.invoiceId
      ) {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      // Grab the freshly tokenized card so we can auto-renew next month.
      // Failing to get one is non-fatal — the customer has paid and must get
      // their plan — but it must not pass silently: getDueSubscriptions() skips
      // rows without a token, so this subscription would stay active and never
      // be charged again. The daily cron retries the lookup; this records why
      // it needs to.
      let cardToken: string | null = null;
      let maskedPan: string | null = null;
      let tokenProblem: string | null = null;
      try {
        const cards = await listWalletCards(userId);
        cardToken = cards[0]?.cardToken ?? null;
        maskedPan = cards[0]?.maskedPan ?? null;
        if (!cardToken) tokenProblem = "monobank returned no saved card for this wallet";
      } catch (err) {
        tokenProblem = err instanceof Error ? err.message : "wallet lookup failed";
      }

      // If the user was already active, this webhook reflects a renewal that
      // the cron sweep didn't resolve synchronously; otherwise it's the first payment.
      const kind = existing && existing.status === "active" ? "renewal" : "initial";

      if (tokenProblem) {
        // Recorded before activation on purpose. If activation fails later,
        // monobank retries — and by then the duplicate check above may short
        // circuit, so a warning logged after activation would be lost exactly
        // in the case that needs it most.
        console.warn(`[billing] no card token for ${userId} on invoice ${payload.invoiceId}: ${tokenProblem}`);
        await logBillingEvent({
          userId,
          eventType: "card_token_missing",
          kind,
          plan,
          invoiceId: payload.invoiceId,
          status: "warning",
          detail: tokenProblem,
        });
      }

      await activateSubscription({
        userId,
        plan,
        invoiceId: payload.invoiceId,
        cardToken,
        maskedPan,
        kind,
      });
      return NextResponse.json({ ok: true, cardToken: !!cardToken });
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
