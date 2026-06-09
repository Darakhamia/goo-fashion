import { NextResponse } from "next/server";
import {
  listWalletCards,
  verifyWebhookSignature,
  type WebhookPayload,
} from "@/lib/server/monobank";
import {
  activateSubscription,
  getSubscription,
  parseReference,
  recordRenewalFailure,
} from "@/lib/server/subscriptions";

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
      let cardToken: string | null = null;
      let maskedPan: string | null = null;
      try {
        const cards = await listWalletCards(userId);
        cardToken = cards[0]?.cardToken ?? null;
        maskedPan = cards[0]?.maskedPan ?? null;
      } catch {
        // Non-fatal: activation should still succeed even if token lookup fails.
        cardToken = null;
      }

      await activateSubscription({
        userId,
        plan,
        invoiceId: payload.invoiceId,
        cardToken,
        maskedPan,
      });
      return NextResponse.json({ ok: true });
    }

    if (
      payload.status === "failure" ||
      payload.status === "expired" ||
      payload.status === "reversed"
    ) {
      const existing = await getSubscription(userId);
      // Only treat as a renewal failure if this user already had an active sub;
      // a failed *first* payment just leaves the pending row untouched.
      if (existing && (existing.status === "active" || existing.status === "past_due")) {
        await recordRenewalFailure(userId);
      }
      return NextResponse.json({ ok: true });
    }

    // created / processing / hold — nothing to do yet.
    return NextResponse.json({ ok: true, pending: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook handling failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
