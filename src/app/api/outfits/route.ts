import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getAllOutfits, readAllOutfits, createOutfit, outfitToDb } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";

/** Most a single ids= lookup will resolve, so one caller can't ask for the lot. */
const MAX_IDS = 24;

export async function GET(req: Request) {
  // ids=a,b,c → just those outfits, in the order asked for. Used by the
  // "Recently viewed" row, which holds ids and needs them back as outfits.
  const idsParam = new URL(req.url).searchParams.get("ids");
  if (idsParam) {
    const outfits = await getAllOutfits();
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
    const byId = new Map(outfits.map((o) => [o.id, o]));
    const picked = ids.map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => Boolean(o));
    return NextResponse.json(picked);
  }

  // The whole list is what the admin Outfits table reads, so a failed read is
  // an error rather than an empty list or demo looks it would show as real.
  // The shop's pages that fetch it keep their own empty state on a non-array.
  const { outfits, error } = await readAllOutfits();
  if (error) return NextResponse.json({ error }, { status: 500 });
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
  const row = outfitToDb(body);
  const { outfit, error } = await createOutfit(row);

  if (!outfit) {
    return NextResponse.json({ error: error ?? "Failed to create outfit." }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json(outfit, { status: 201 });
}
