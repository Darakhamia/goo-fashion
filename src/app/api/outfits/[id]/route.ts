import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { updateOutfit, outfitToDb, toggleOutfitHomepageFeatured } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 501 }
    );
  }

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const row = outfitToDb(body);
  const outfit = await updateOutfit(id, row);

  if (!outfit) {
    return NextResponse.json({ error: "Failed to update outfit." }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json(outfit);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (typeof body.isHomepageFeatured === "boolean") {
    const ok = await toggleOutfitHomepageFeatured(id, body.isHomepageFeatured);
    if (!ok) return NextResponse.json({ error: "Failed to update." }, { status: 500 });
    revalidatePath("/");
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown patch operation." }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 501 }
    );
  }

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Clear FK reference in pending_looks before deleting the outfit
  await supabase!.from("pending_looks").update({ outfit_id: null }).eq("outfit_id", id);

  const { error } = await supabase!.from("outfits").delete().eq("id", id);

  if (error) {
    console.error("[api] deleteOutfit:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
