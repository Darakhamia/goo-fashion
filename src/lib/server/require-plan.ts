import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  coercePlan,
  FEATURE_LABELS,
  minimumPlanFor,
  PLANS,
  planHasFeature,
  type Feature,
  type PlanId,
} from "@/lib/plans";

export interface PlanCheckSuccess {
  ok: true;
  userId: string;
  plan: PlanId;
}

export interface PlanCheckFailure {
  ok: false;
  response: NextResponse;
}

/**
 * Gate an API route behind a plan feature.
 *
 * On success, returns the authenticated userId + resolved plan.
 * On failure, returns a NextResponse the caller should return directly:
 *   - 401 if not signed in
 *   - 402 { error, feature, requiredPlan, upgradeUrl } if plan lacks the feature
 *
 * Clients should catch 402 and redirect to `/plans` (or open an upgrade modal).
 */
export async function requirePlan(
  feature: Feature
): Promise<PlanCheckSuccess | PlanCheckFailure> {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sign in to use this feature." },
        { status: 401 }
      ),
    };
  }

  // Read plan from Clerk publicMetadata. Defaults to "free" when absent.
  let plan: PlanId = "free";
  try {
    const cc = await clerkClient();
    const user = await cc.users.getUser(userId);
    plan = coercePlan((user.publicMetadata as { plan?: unknown }).plan);
  } catch {
    // If Clerk fetch fails, treat as free — we never want to grant access on error.
    plan = "free";
  }

  if (planHasFeature(plan, feature)) {
    return { ok: true, userId, plan };
  }

  const requiredPlan = minimumPlanFor(feature);
  const featureLabel = FEATURE_LABELS[feature];
  const requiredName = requiredPlan ? PLANS[requiredPlan].name : null;

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: requiredName
          ? `${featureLabel} is available on ${requiredName} and above. Upgrade to continue.`
          : `${featureLabel} is not available on your plan.`,
        feature,
        currentPlan: plan,
        requiredPlan,
        upgradeUrl: requiredPlan ? `/plans?highlight=${requiredPlan}` : "/plans",
      },
      { status: 402 }
    ),
  };
}
