import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server/admin-auth";
import { BILLING_CCY, PAID_PLAN_IDS, PLANS, type PlanId } from "@/lib/plans";
import { SITE_URL } from "@/lib/seo";
import { createInvoice, isMonobankConfigured, MonobankError } from "@/lib/server/monobank";
import { startBankSubscription } from "@/lib/server/mono-subscriptions";
import { coerceInterval, TEST_AMOUNT_MINOR, TEST_INTERVAL } from "@/lib/server/billing-terms";
import {
  buildReference,
  getSubscription,
  logBillingEvent,
  upsertPendingSubscription,
  type SubscriptionRow,
} from "@/lib/server/subscriptions";

/*
 * Test subscription (goo-studio → Subscriptions; BILLING.md, "Test
 * subscription"): the super admin subscribes their own account for 10 UAH a
 * day, through the same roads as a real checkout — a monobank subscription if
 * the bank opens one, otherwise an invoice that saves the card, renewed daily
 * by the renewal cron. Only the period and the amount differ
 * (billing-terms.ts). It is stopped like any plan: POST /api/billing/cancel.
 *
 * Super admin only: for anyone else this would be a paid plan for 10 UAH a day.
 */

type PaidPlanId = Exclude<PlanId, "free">;

/** The caller's own plan row, as the test card shows it. The card token never leaves the server. */
function describe(sub: SubscriptionRow | null) {
  if (!sub) return null;
  return {
    plan: sub.plan,
    status: sub.status,
    interval: coerceInterval(sub.billing_interval),
    amountMinor: sub.amount,
    autoRenew: sub.auto_renew,
    currentPeriodEnd: sub.current_period_end,
    maskedPan: sub.masked_pan,
    hasCardToken: !!sub.card_token,
    bankSubscription: !!sub.mono_subscription_id,
  };
}

/** A real plan that is still being renewed: a test started now would bill on top of it. */
function realPlanRunning(sub: SubscriptionRow | null): boolean {
  return (
    !!sub &&
    sub.status === "active" &&
    sub.auto_renew &&
    coerceInterval(sub.billing_interval) === "1m" &&
    !!sub.current_period_end &&
    new Date(sub.current_period_end) > new Date()
  );
}

export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sub = await getSubscription(admin.userId);
    return NextResponse.json({
      configured: isMonobankConfigured,
      amountMinor: TEST_AMOUNT_MINOR,
      interval: TEST_INTERVAL,
      subscription: describe(sub),
      realPlanRunning: realPlanRunning(sub),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = admin.userId;

  if (!isMonobankConfigured) {
    return NextResponse.json({ error: "Payments are not configured. Set MONOBANK_TOKEN." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { plan?: string } | null;
  if (!body?.plan || !PAID_PLAN_IDS.includes(body.plan as PlanId)) {
    return NextResponse.json({ error: "Invalid plan. Pick basic, pro, or premium." }, { status: 400 });
  }
  const plan = body.plan as PaidPlanId;
  const amount = TEST_AMOUNT_MINOR;
  const interval = TEST_INTERVAL;

  try {
    const current = await getSubscription(userId);
    if (realPlanRunning(current)) {
      return NextResponse.json(
        { error: "A real paid plan is renewing on this account. Cancel it in the profile first." },
        { status: 409 },
      );
    }
    if (
      current?.status === "active" &&
      current.auto_renew &&
      coerceInterval(current.billing_interval) === interval &&
      current.current_period_end &&
      new Date(current.current_period_end) > new Date()
    ) {
      return NextResponse.json({ error: "A test subscription is already running." }, { status: 409 });
    }

    const bank = await startBankSubscription({ userId, plan, amount, interval });
    if (bank.kind === "started") {
      return NextResponse.json({ pageUrl: bank.pageUrl, road: "subscription" });
    }
    console.warn(`[billing] test: monobank subscription unavailable (${bank.kind}: ${bank.reason}); falling back to an invoice`);

    const invoice = await createInvoice({
      amount,
      ccy: BILLING_CCY,
      reference: buildReference(userId, plan, interval),
      destination: `Goo Fashion — ${PLANS[plan].name} (test, daily)`,
      redirectUrl: `${SITE_URL}/subscribe?plan=${plan}&status=return`,
      webHookUrl: `${SITE_URL}/api/billing/webhook`,
      walletId: userId,
    });

    await upsertPendingSubscription({ userId, plan, amount, ccy: BILLING_CCY, invoiceId: invoice.invoiceId, interval });
    await logBillingEvent({
      userId,
      eventType: "checkout_started",
      plan,
      invoiceId: invoice.invoiceId,
      amount,
      ccy: BILLING_CCY,
      detail: "test subscription, daily",
    });

    return NextResponse.json({ pageUrl: invoice.pageUrl, road: "invoice" });
  } catch (err) {
    const msg = err instanceof MonobankError || err instanceof Error ? err.message : "Checkout failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
