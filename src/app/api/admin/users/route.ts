import { NextResponse } from "next/server";
import { clerkClient, type User } from "@clerk/nextjs/server";
import { requireAdmin, isSuperAdminId } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { envAdminIds, matchesStatus, planOf, scanUsers, type StatusFilter } from "./user-list";

export interface AdminUserSubscription {
  plan: string;
  status: string;
  /** Monthly charge in whole UAH */
  amountUah: number;
  autoRenew: boolean;
  maskedPan: string | null;
  /** When the subscription row was created (first payment) */
  startedAt: string;
  /** End of the paid period / next charge date */
  currentPeriodEnd: string | null;
}

export interface AdminUserRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string;
  createdAt: number;
  lastSignInAt: number | null;
  lastActiveAt: number | null;
  banned: boolean;
  locked: boolean;
  plan: "free" | "basic" | "pro" | "premium" | string;
  isAdmin: boolean;
  /** Admin through ADMIN_USER_IDS — the Admin toggle cannot revoke it. */
  adminViaEnv: boolean;
  isSuperAdmin: boolean;
  subscription: AdminUserSubscription | null;
}

// GET /api/admin/users?q=<query>&plan=<plan>&status=<active|banned|locked>&limit=<n>&offset=<n>
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q")?.trim() || undefined;
  const planQ  = searchParams.get("plan")?.trim();
  const plan   = planQ && planQ !== "all" ? planQ : undefined;
  const statusQ = searchParams.get("status")?.trim();
  const status = statusQ === "active" || statusQ === "banned" || statusQ === "locked"
    ? (statusQ as StatusFilter)
    : undefined;
  const limit  = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  try {
    let pageUsers: User[];
    let totalCount: number;
    // True when a filtered listing stopped at the scan cap and may miss users.
    let partial = false;

    if (plan || status) {
      // Clerk cannot filter on plan or ban state, so filter the whole list here
      // and paginate the result — otherwise a page of 25 shrinks to a handful.
      const scan = await scanUsers(q);
      const matching = scan.users.filter(
        (u) => (!plan || planOf(u) === plan) && matchesStatus(u, status),
      );
      pageUsers = matching.slice(offset, offset + limit);
      totalCount = matching.length;
      partial = scan.truncated;
    } else {
      const cc = await clerkClient();
      const result = await cc.users.getUserList({
        query: q,
        orderBy: "-created_at",
        limit,
        offset,
      });
      pageUsers = result.data;
      totalCount = result.totalCount ?? offset + result.data.length;
    }

    const adminIds = envAdminIds();

    // Billing ledger for this page of users — one query, keyed by Clerk id.
    const subsByUser = new Map<string, AdminUserSubscription>();
    let subscriptionsError: string | null = null;
    if (isSupabaseConfigured && supabase && pageUsers.length > 0) {
      const { data: subRows, error: subErr } = await supabase
        .from("subscriptions")
        .select("user_id,plan,status,amount,auto_renew,masked_pan,created_at,current_period_end")
        .in("user_id", pageUsers.map((u) => u.id));
      if (subErr) subscriptionsError = subErr.message;
      for (const s of (subRows ?? []) as {
        user_id: string; plan: string; status: string; amount: number;
        auto_renew: boolean; masked_pan: string | null; created_at: string;
        current_period_end: string | null;
      }[]) {
        subsByUser.set(s.user_id, {
          plan: s.plan,
          status: s.status,
          amountUah: Math.round(s.amount / 100),
          autoRenew: s.auto_renew,
          maskedPan: s.masked_pan,
          startedAt: s.created_at,
          currentPeriodEnd: s.current_period_end,
        });
      }
    }

    const rows: AdminUserRow[] = pageUsers.map((u) => {
      const meta = (u.publicMetadata ?? {}) as { isAdmin?: boolean };
      const adminViaEnv = adminIds.includes(u.id);
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.emailAddresses[0]?.emailAddress ?? null,
        imageUrl: u.imageUrl,
        createdAt: u.createdAt,
        lastSignInAt: u.lastSignInAt,
        lastActiveAt: u.lastActiveAt ?? null,
        banned: u.banned,
        locked: u.locked,
        plan: planOf(u),
        isAdmin: meta.isAdmin === true || adminViaEnv,
        adminViaEnv,
        isSuperAdmin: isSuperAdminId(u.id),
        subscription: subsByUser.get(u.id) ?? null,
      };
    });

    return NextResponse.json({
      users: rows,
      totalCount,
      limit,
      offset,
      partial,
      subscriptionsError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
