import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cancelAutoRenew, getSubscription, logBillingEvent } from "@/lib/server/subscriptions";

/**
 * Cancel auto-renewal. The user keeps their plan until the current period ends
 * (require-plan.ts reads Clerk metadata, which we leave intact); the cron sweep
 * simply won't charge again because auto_renew is now false.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in." }, { status: 401 });
  }

  try {
    const sub = await getSubscription(userId);
    if (!sub) {
      return NextResponse.json({ error: "No active subscription." }, { status: 404 });
    }
    await cancelAutoRenew(userId);
    await logBillingEvent({
      userId,
      eventType: "canceled",
      plan: sub.plan,
      detail: "auto-renew disabled by user",
    });
    return NextResponse.json({ ok: true, currentPeriodEnd: sub.current_period_end });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cancel failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
