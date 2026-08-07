import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { coercePlan } from "@/lib/plans";
import { getUsage } from "@/lib/server/usage";

/**
 * This month's allowance and what is left of it.
 *
 * Feeds the profile page and the builder's generate control, so a customer can
 * see the number they are spending against instead of discovering the ceiling
 * by hitting it.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // publicMetadata is always present on the full user record, unlike
  // sessionClaims, which depends on the JWT template being configured.
  let plan: ReturnType<typeof coercePlan> = "free";
  try {
    const user = await currentUser();
    plan = coercePlan((user?.publicMetadata as { plan?: unknown } | null)?.plan);
  } catch {
    /* default to free */
  }

  const usage = await getUsage(userId, plan);
  return NextResponse.json({ plan, ...usage });
}
