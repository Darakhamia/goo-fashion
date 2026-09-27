import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getOutfitsByIds, readAllOutfits, createOutfit, outfitToDb } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { MAX_OUTFIT_ITEMS } from "@/lib/outfit-limits";

/** Most a single ids= lookup will resolve, so one caller can't ask for the lot. */
const MAX_IDS = 24;

export async function GET(req: Request) {
  // ids=a,b,c → just those outfits, in the order asked for. Used by the
  // "Recently viewed" row, which holds ids and needs them back as outfits.
  const idsParam = new URL(req.url).searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
    if (ids.length === 0) return NextResponse.json([]);
    return NextResponse.json(await getOutfitsByIds(ids));
  }

  // The whole list is what the admin Outfits table reads, so a failed read is
  // an error rather than an empty list or demo looks it would show as real.
  // The shop's pages that fetch it keep their own empty state on a non-array.
  // The database's own message is for admins only; the shop gets a plain one.
  const { outfits, error } = await readAllOutfits();
  if (error) {
    console.error("[api/outfits] list:", error);
    const admin = await requireAdmin();
    return NextResponse.json(
      { error: admin ? `Could not load outfits: ${error}` : "Could not load outfits." },
      { status: 500 },
    );
  }
  return NextResponse.json(outfits);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 501 }
    );
  }

  const body = await req.json();

  // body.items = [{ productId, role }]
  if (Array.isArray(body.items) && body.items.length > MAX_OUTFIT_ITEMS) {
    return NextResponse.json(
      { error: `An outfit takes up to ${MAX_OUTFIT_ITEMS} items.` },
      { status: 400 }
    );
  }
  const row = outfitToDb(body);
  const { outfit, error } = await createOutfit(row);

  if (!outfit) {
    return NextResponse.json({ error: error ?? "Failed to create outfit." }, { status: 500 });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "outfits.created",
    target_id: outfit.id,
    target_type: "outfit",
    metadata: { name: outfit.name },
  });

  revalidatePath("/");
  return NextResponse.json(outfit, { status: 201 });
}
