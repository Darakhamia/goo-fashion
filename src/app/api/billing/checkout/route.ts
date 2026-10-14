import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  PAID_PLAN_IDS,
  PLANS,
  BILLING_CCY,
  planPriceMinor,
  type PlanId,
} from "@/lib/plans";
import { SITE_URL } from "@/lib/seo";
import { createInvoice, isMonobankConfigured, MonobankError } from "@/lib/server/monobank";
import { startBankSubscription } from "@/lib/server/mono-subscriptions";
import { buildReference, getSubscription, logBillingEvent, upsertPendingSubscription } from "@/lib/server/subscriptions";

/**
 * Start a real monobank checkout for the requested plan.
 *
 * Every click first asks monobank for a subscription the bank charges by
 * itself each month. Only if the bank refuses one to this merchant (or
 * migration 028 is missing) does it fall back to a one-off invoice that
 * tokenizes the card for the renewal cron, as before. Either way the client
 * gets a hosted `pageUrl` to redirect to, and the plan is only unlocked once
 * monobank reports the payment (BILLING.md → "How it works").
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });
  }

  if (!isMonobankConfigured) {
    return NextResponse.json(
      { error: "Payments are not configured. Set MONOBANK_TOKEN." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as { plan?: string } | null;
  const requestedPlan = body?.plan;
  if (!requestedPlan || !PAID_PLAN_IDS.includes(requestedPlan as PlanId)) {
    return NextResponse.json(
      { error: "Invalid plan. Pick basic, pro, or premium." },
      { status: 400 }
    );
  }
  const plan = requestedPlan as Exclude<PlanId, "free">;
  const amount = planPriceMinor(plan);

  try {
    // Paying again for the plan that is already running would only stack a
    // second monthly charge on the first.
    const current = await getSubscription(userId).catch(() => null);
    if (
      current?.status === "active" &&
      current.plan === plan &&
      current.auto_renew &&
      current.current_period_end &&
      new Date(current.current_period_end) > new Date()
    ) {
      return NextResponse.json({ error: "You are already subscribed to this plan." }, { status: 409 });
    }

    const bank = await startBankSubscription({ userId, plan, amount });
    if (bank.kind === "started") {
      return NextResponse.json({ pageUrl: bank.pageUrl, subscriptionId: bank.subscriptionId });
    }
    console.warn(`[billing] monobank subscription unavailable (${bank.kind}: ${bank.reason}); falling back to an invoice`);

    const invoice = await createInvoice({
      amount,
      ccy: BILLING_CCY,
      reference: buildReference(userId, plan),
      destination: `Goo Fashion — ${PLANS[plan].name} (monthly)`,
      redirectUrl: `${SITE_URL}/subscribe?plan=${plan}&status=return`,
      webHookUrl: `${SITE_URL}/api/billing/webhook`,
      walletId: userId,
    });

    await upsertPendingSubscription({
      userId,
      plan,
      amount,
      ccy: BILLING_CCY,
      invoiceId: invoice.invoiceId,
    });

    await logBillingEvent({
      userId,
      eventType: "checkout_started",
      plan,
      invoiceId: invoice.invoiceId,
      amount,
      ccy: BILLING_CCY,
    });

    return NextResponse.json({ pageUrl: invoice.pageUrl, invoiceId: invoice.invoiceId });
  } catch (err) {
    const msg =
      err instanceof MonobankError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Checkout failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
