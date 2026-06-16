import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { clerkClient } from "@clerk/nextjs/server";
import { getHomepageShowcaseIds, type HomepageShowcaseIds } from "@/lib/data/db";

const KEY = "homepage_showcase";
const STEPS = ["step1", "step2", "step3", "step4"] as const;
// Generous per-step cap — the scenes render at most a few, but we keep extras.
const MAX_PER_STEP = 6;

// GET /api/admin/homepage-showcase → { step1: string[], … }
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ids = await getHomepageShowcaseIds();
  return NextResponse.json(ids, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/admin/homepage-showcase  Body: { step1: string[], … }
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const clean: HomepageShowcaseIds = { step1: [], step2: [], step3: [], step4: [] };
  for (const step of STEPS) {
    const arr = (body as Record<string, unknown>)[step];
    if (Array.isArray(arr)) {
      clean[step] = Array.from(
        new Set(arr.filter((x): x is string => typeof x === "string"))
      ).slice(0, MAX_PER_STEP);
    }
  }

  const { error } = await supabase
    .from("settings")
    .upsert(
      { key: KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/");

  try {
    const cc = await clerkClient();
    const adminUser = await cc.users.getUser(admin.userId);
    void logAdminAction({
      admin_id: admin.userId,
      admin_email: adminUser.emailAddresses[0]?.emailAddress,
      action: "settings.homepage_showcase_updated",
      target_type: "settings",
      metadata: { key: KEY },
    });
  } catch {
    /* non-critical */
  }

  return NextResponse.json({ ok: true, ...clean });
}
