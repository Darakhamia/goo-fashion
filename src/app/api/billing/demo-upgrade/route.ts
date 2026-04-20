import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { coercePlan, PAID_PLAN_IDS, type PlanId } from "@/lib/plans";

/**
 * Demo-only checkout endpoint.
 *
 * Writes the requested plan to the user's Clerk publicMetadata.plan.
 * There is NO payment processor — this is purely a UX placeholder so we can
 * demo the paywall end-to-end. Replace with a real Stripe/Paddle webhook when
 * billing is wired up.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to subscribe." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null) as { plan?: string } | null;
  const requestedPlan = body?.plan;

  if (!requestedPlan || !PAID_PLAN_IDS.includes(requestedPlan as PlanId)) {
    return NextResponse.json(
      { error: "Invalid plan. Pick basic, pro, or premium." },
      { status: 400 }
    );
  }

  try {
    const cc = await clerkClient();
    const user = await cc.users.getUser(userId);
    const currentMeta = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await cc.users.updateUserMetadata(userId, {
      publicMetadata: { ...currentMeta, plan: requestedPlan },
    });

    return NextResponse.json({
      ok: true,
      plan: coercePlan(requestedPlan),
      demo: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upgrade failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
