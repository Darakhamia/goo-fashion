import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { clerkClient } from "@clerk/nextjs/server";
import { getHomepageStylistIds, type HomepageStylistIds } from "@/lib/data/db";

const KEY = "homepage_stylist";
const MAX_CHAT_LOOKS = 2;
const MAX_SHOWCASE_STORES = 6;

// GET /api/admin/homepage-stylist → { chatOutfits: string[], featuredProduct: string|null }
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ids = await getHomepageStylistIds();
  return NextResponse.json(ids, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/admin/homepage-stylist  Body: { chatOutfits: string[], featuredProduct: string|null }
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

  const rawOutfits = (body as Record<string, unknown>).chatOutfits;
  const rawProduct = (body as Record<string, unknown>).featuredProduct;
  // `extraStores` is the current field; legacy `stores`/`brands` (string[]) are
  // accepted for back-compat.
  const rawStores =
    (body as Record<string, unknown>).extraStores ??
    (body as Record<string, unknown>).stores ??
    (body as Record<string, unknown>).brands;

  // Normalize extra stores → { name, price }, dedupe by name, keep first.
  const extraStores: HomepageStylistIds["extraStores"] = [];
  if (Array.isArray(rawStores)) {
    const seen = new Set<string>();
    for (const item of rawStores) {
      let name = "";
      let price: number | null = null;
      if (typeof item === "string") {
        name = item.trim();
      } else if (item && typeof item === "object") {
        const n = (item as Record<string, unknown>).name;
        const p = (item as Record<string, unknown>).price;
        if (typeof n === "string") name = n.trim();
        if (typeof p === "number" && p > 0) price = p;
      }
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      extraStores.push({ name, price });
      if (extraStores.length >= MAX_SHOWCASE_STORES) break;
    }
  }

  const clean: HomepageStylistIds = {
    chatOutfits: Array.isArray(rawOutfits)
      ? Array.from(new Set(rawOutfits.filter((x): x is string => typeof x === "string"))).slice(
          0,
          MAX_CHAT_LOOKS
        )
      : [],
    featuredProduct: typeof rawProduct === "string" && rawProduct ? rawProduct : null,
    extraStores,
  };

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
      action: "settings.homepage_stylist_updated",
      target_type: "settings",
      metadata: { key: KEY },
    });
  } catch {
    /* non-critical */
  }

  return NextResponse.json({ ok: true, ...clean });
}
