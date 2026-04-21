import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getAllOutfits, createOutfit, outfitToDb } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";

export async function GET() {
  const outfits = await getAllOutfits();
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
    const msg = error ?? "Failed to create outfit.";
    // Table missing → let client save locally
    const status = msg.includes("does not exist") ? 501 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  revalidatePath("/");
  return NextResponse.json(outfit, { status: 201 });
}
