import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { updateOutfit, outfitPatchToDb, toggleOutfitHomepageFeatured } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";

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
  const body = await req.json().catch(() => null);
  // Only what the studio's editor changes: the name, the words, the styles,
  // the seasons, the cover and the AI mark. The pieces and the price stay as
  // the look was built — this used to rewrite the whole row from whatever the
  // form sent, items and price included.
  const row = outfitPatchToDb(body ?? {});
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  if (row.name === "") {
    return NextResponse.json({ error: "An outfit needs a name." }, { status: 400 });
  }
  const { outfit, error } = await updateOutfit(id, row);

  if (!outfit) {
    return NextResponse.json({ error: error ?? "Failed to update outfit." }, { status: 500 });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "outfits.updated",
    target_id: id,
    target_type: "outfit",
    metadata: { name: outfit.name, fields: Object.keys(row) },
  });

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
    await logAdminAction({
      admin_id: admin.userId,
      action: "outfits.updated",
      target_id: id,
      target_type: "outfit",
      metadata: { fields: ["is_homepage_featured"], value: body.isHomepageFeatured },
    });
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

  const { data: deleted, error } = await supabase!.from("outfits").delete().eq("id", id).select("name");

  if (error) {
    console.error("[api] deleteOutfit:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const gone = ((deleted ?? []) as { name: string | null }[])[0];
  if (gone) {
    await logAdminAction({
      admin_id: admin.userId,
      action: "outfits.deleted",
      target_id: id,
      target_type: "outfit",
      metadata: { name: gone.name },
    });
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
