import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { planOf, scanUsers, SCAN_CAP } from "../user-list";

// GET /api/admin/users/counts — plan and ban tallies across all users, for the
// stat cards on /goo-studio/users. Counted here rather than from the page of
// users the browser happens to hold, so the cards agree with "Total".
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const scan = await scanUsers();
    const counts = { premium: 0, pro: 0, basic: 0, free: 0, banned: 0 };
    for (const u of scan.users) {
      const plan = planOf(u);
      if (plan === "premium" || plan === "pro" || plan === "basic" || plan === "free") counts[plan]++;
      if (u.banned) counts.banned++;
    }
    return NextResponse.json({
      total: scan.totalCount,
      ...counts,
      // When Clerk holds more than SCAN_CAP users the plan tallies cover only
      // the newest SCAN_CAP; the page labels them as such.
      partial: scan.truncated,
      scanned: scan.users.length,
      scanCap: SCAN_CAP,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
