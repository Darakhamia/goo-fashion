import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/server/admin-auth";

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
