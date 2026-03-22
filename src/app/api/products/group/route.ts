import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * POST /api/products/group
 *
 * Groups a set of existing products as color variants of each other.
 * All products share a single variantGroupId; the primary is flagged.
 *
 * Body:
 * {
 *   ids: string[];                         // product IDs to group
 *   primaryId: string;                     // which one is the catalog representative
 *   colorHexMap: Record<string, string>;   // productId → hex color
 *   groupId?: string;                      // if omitted, a new UUID is generated
 * }
 *
 * DELETE /api/products/group
 *
 * Unlinks all products in a group (sets variant_group_id to null).
 * Body: { groupId: string }
 */

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 501 }
    );
  }

  const body = await req.json();
  const { ids, primaryId, colorHexMap, groupId: existingGroupId } = body as {
    ids: string[];
    primaryId: string;
    colorHexMap: Record<string, string>;
    groupId?: string;
  };

  if (!ids?.length || !primaryId) {
    return NextResponse.json({ error: "ids and primaryId are required." }, { status: 400 });
  }

  // Use supplied groupId or generate a new one
  const groupId = existingGroupId || crypto.randomUUID();

  // Update each product individually
  const updates = ids.map((id) =>
    supabase!
      .from("products")
      .update({
        variant_group_id: groupId,
        color_hex: colorHexMap?.[id] ?? null,
        is_group_primary: id === primaryId,
      })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.filter((r) => r.error);
  if (failed.length) {
    console.error("[group] partial failure:", failed.map((r) => r.error?.message));
    return NextResponse.json(
      { error: "Some products could not be updated.", details: failed.map((r) => r.error?.message) },
      { status: 500 }
    );
  }

  return NextResponse.json({ groupId, updated: ids.length });
}

export async function DELETE(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const body = await req.json();
  const { groupId } = body as { groupId: string };

  if (!groupId) {
    return NextResponse.json({ error: "groupId is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("products")
    .update({ variant_group_id: null, is_group_primary: false, color_hex: null })
    .eq("variant_group_id", groupId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
