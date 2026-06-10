import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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
  subscription: AdminUserSubscription | null;
}

// GET /api/admin/users?q=<query>&plan=<plan>&limit=<n>&offset=<n>
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q")?.trim() || undefined;
  const plan   = searchParams.get("plan")?.trim() || undefined;
  const limit  = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  try {
    const cc = await clerkClient();
    const result = await cc.users.getUserList({
      query: q,
      orderBy: "-created_at",
      limit,
      offset,
    });

    const adminIds = (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Billing ledger for this page of users — one query, keyed by Clerk id.
    const subsByUser = new Map<string, AdminUserSubscription>();
    if (isSupabaseConfigured && supabase && result.data.length > 0) {
      const { data: subRows } = await supabase
        .from("subscriptions")
        .select("user_id,plan,status,amount,auto_renew,masked_pan,created_at,current_period_end")
        .in("user_id", result.data.map((u) => u.id));
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

    let rows: AdminUserRow[] = result.data.map((u) => {
      const meta = (u.publicMetadata ?? {}) as { plan?: string; isAdmin?: boolean };
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
        plan: meta.plan ?? "free",
        isAdmin: meta.isAdmin === true || adminIds.includes(u.id),
        subscription: subsByUser.get(u.id) ?? null,
      };
    });

    if (plan && plan !== "all") {
      rows = rows.filter((r) => r.plan === plan);
    }

    return NextResponse.json({
      users: rows,
      totalCount: result.totalCount ?? rows.length,
      limit,
      offset,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
