import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";

const MIGRATION_COLUMNS = ["variant_group_id", "color_hex", "is_group_primary"];

/** What the admin sees when the variant columns were never added. */
const MISSING_COLUMNS_MESSAGE =
  "The products table has no variant columns (variant_group_id, color_hex, is_group_primary). " +
  "Add them from supabase-schema.sql, then try again.";

function isMissingColumnError(msg: string) {
  return (
    MIGRATION_COLUMNS.some((col) => msg.includes(col)) &&
    (msg.includes("Could not find") || msg.includes("column") || msg.includes("schema cache"))
  );
}

/**
 * POST — link products as color variants.
 *   { ids, primaryId, colorHexMap, groupId? }
 *
 * Every id gets `is_group_primary = (id === primaryId)`. A primaryId outside
 * `ids` therefore leaves the group's current primary where it is.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  const { ids, primaryId, colorHexMap, groupId: existingGroupId } = (body ?? {}) as {
    ids: string[];
    primaryId: string;
    colorHexMap: Record<string, string>;
    groupId?: string;
  };

  if (!ids?.length || !primaryId) {
    return NextResponse.json({ error: "ids and primaryId are required." }, { status: 400 });
  }

  const groupId = existingGroupId || crypto.randomUUID();

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
    const errorMessages = failed.map((r) => r.error?.message ?? "unknown");
    console.error("[group] partial failure:", errorMessages);

    if (errorMessages.some(isMissingColumnError)) {
      return NextResponse.json({ error: MISSING_COLUMNS_MESSAGE, needsMigration: true }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Some products could not be updated.", details: errorMessages },
      { status: 500 }
    );
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "products.updated",
    target_id: groupId,
    target_type: "variant_group",
    metadata: { variants: "grouped", ids, primaryId },
  });

  return NextResponse.json({ groupId, updated: ids.length });
}

/**
 * DELETE — unlink variants.
 *   { groupId }  → every product in that group
 *   { ids }      → just those products (the rest of their group stays linked)
 */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  const { groupId, ids } = (body ?? {}) as { groupId?: string; ids?: string[] };
  const idList = Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id) : [];

  if (!groupId && !idList.length) {
    return NextResponse.json({ error: "groupId or ids is required." }, { status: 400 });
  }

  const unlink = supabase
    .from("products")
    .update({ variant_group_id: null, is_group_primary: false, color_hex: null });
  const { data: unlinked, error } = groupId
    ? await unlink.eq("variant_group_id", groupId).select("id")
    : await unlink.in("id", idList).select("id");

  if (error) {
    if (isMissingColumnError(error.message)) {
      return NextResponse.json({ error: MISSING_COLUMNS_MESSAGE, needsMigration: true }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "products.updated",
    target_id: groupId,
    target_type: "variant_group",
    // The rows actually unlinked: a whole group is asked for by its id alone.
    metadata: { variants: "ungrouped", ids: ((unlinked ?? []) as { id: string }[]).map((r) => r.id) },
  });

  return NextResponse.json({ ok: true });
}
