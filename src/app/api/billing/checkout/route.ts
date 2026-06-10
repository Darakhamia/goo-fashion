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
import { buildReference, logBillingEvent, upsertPendingSubscription } from "@/lib/server/subscriptions";

/**
 * Start a real monobank checkout for the requested plan.
 *
 * Creates a monobank invoice (tokenizing the card via walletId so we can
 * auto-renew monthly), stores a pending subscription, and returns the hosted
 * `pageUrl` for the client to redirect to. The plan is only unlocked once
 * monobank confirms payment via the webhook.
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
