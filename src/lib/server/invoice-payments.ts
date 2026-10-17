import { supabase } from "@/lib/supabase";
import type { PlanId } from "@/lib/plans";
import type { BillingInterval } from "@/lib/server/billing-terms";
import { getInvoiceStatus, listWalletCards } from "@/lib/server/monobank";
import { activateSubscription, getSubscription, logBillingEvent, parseReference } from "@/lib/server/subscriptions";

/**
 * Road 2: a one-off monobank invoice, used when the bank refuses a
 * subscription. Its webhook is signed; this module is what the webhook and the
 * hourly sync share once an invoice is known to be paid.
 */

/**
 * The invoice is paid: switch the plan on and keep the card monobank saved,
 * for the renewal cron. A second call for the same invoice is a no-op.
 */
export async function applyInvoicePaid(args: {
  userId: string;
  plan: PlanId;
  invoiceId: string;
  /** From the invoice reference: '1d' only for the goo-studio test subscription. */
  interval?: BillingInterval;
}): Promise<{ duplicate: boolean; cardToken: boolean }> {
  const { userId, plan, invoiceId, interval } = args;

  // Idempotency: ignore duplicate success callbacks for the same invoice.
  const existing = await getSubscription(userId);
  if (existing && existing.status === "active" && existing.last_invoice_id === invoiceId) {
    return { duplicate: true, cardToken: !!existing.card_token };
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

  // If the user was already active, this reflects a renewal that the cron
  // sweep didn't resolve synchronously; otherwise it's the first payment.
  const kind = existing && existing.status === "active" ? "renewal" : "initial";

  if (tokenProblem) {
    // Recorded before activation on purpose. If activation fails later,
    // monobank retries — and by then the duplicate check above may short
    // circuit, so a warning logged after activation would be lost exactly
    // in the case that needs it most.
    console.warn(`[billing] no card token for ${userId} on invoice ${invoiceId}: ${tokenProblem}`);
    await logBillingEvent({
      userId,
      eventType: "card_token_missing",
      kind,
      plan,
      invoiceId,
      status: "warning",
      detail: tokenProblem,
    });
  }

  await activateSubscription({ userId, plan, invoiceId, cardToken, maskedPan, kind, interval });
  return { duplicate: false, cardToken: !!cardToken };
}

/**
 * Checkouts by invoice still pending after their webhook should have arrived:
 * ask monobank, and apply the ones that were paid. Webhooks get lost; this is
 * the hourly backstop. Looks back two days — monobank invoices live one.
 */
export async function reconcilePendingInvoices(): Promise<Array<{ userId: string; invoiceId: string; outcome: string }>> {
  if (!supabase) return [];
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id, last_invoice_id")
    .eq("status", "pending")
    .not("last_invoice_id", "is", null)
    .gte("updated_at", since);
  if (error) throw new Error(error.message);

  const out: Array<{ userId: string; invoiceId: string; outcome: string }> = [];
  for (const row of (data ?? []) as Array<{ user_id: string; last_invoice_id: string }>) {
    const invoiceId = row.last_invoice_id;
    try {
      const invoice = await getInvoiceStatus(invoiceId);
      if (invoice.status !== "success") {
        out.push({ userId: row.user_id, invoiceId, outcome: invoice.status });
        continue;
      }
      // The reference is what the invoice was created for, not what the row
      // says now — a newer checkout may have rewritten the row.
      const ref = parseReference(invoice.reference);
      if (!ref || ref.userId !== row.user_id) {
        out.push({ userId: row.user_id, invoiceId, outcome: "reference-mismatch" });
        continue;
      }
      const applied = await applyInvoicePaid({ userId: ref.userId, plan: ref.plan, invoiceId, interval: ref.interval });
      out.push({ userId: row.user_id, invoiceId, outcome: applied.duplicate ? "duplicate" : "paid" });
    } catch (err) {
      console.error(`[billing] invoice ${invoiceId} reconcile failed: ${err instanceof Error ? err.message : String(err)}`);
      out.push({ userId: row.user_id, invoiceId, outcome: "error" });
    }
  }
  return out;
}
