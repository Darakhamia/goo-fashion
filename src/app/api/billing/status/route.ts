import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSubscription } from "@/lib/server/subscriptions";

/** Current user's billing state, for the profile "Plan" tab. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in." }, { status: 401 });
  }

  try {
    const sub = await getSubscription(userId);
    if (!sub) {
      return NextResponse.json({ subscription: null });
    }
    return NextResponse.json({
      subscription: {
        plan: sub.plan,
        status: sub.status,
        amount: sub.amount,
        ccy: sub.ccy,
        autoRenew: sub.auto_renew,
        currentPeriodEnd: sub.current_period_end,
        maskedPan: sub.masked_pan,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not load billing.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
