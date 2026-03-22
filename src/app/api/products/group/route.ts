import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const MIGRATION_COLUMNS = ["variant_group_id", "color_hex", "is_group_primary"];

function isMissingColumnError(msg: string) {
  return MIGRATION_COLUMNS.some((col) => msg.includes(col)) &&
    (msg.includes("Could not find") || msg.includes("column") || msg.includes("schema cache"));
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
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

    // Detect missing migration columns
    const needsMigration = errorMessages.some(isMissingColumnError);
    if (needsMigration) {
      return NextResponse.json(
        { error: "MIGRATION_REQUIRED", needsMigration: true },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Some products could not be updated.", details: errorMessages },
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
    const needsMigration = isMissingColumnError(error.message);
    if (needsMigration) {
      return NextResponse.json({ error: "MIGRATION_REQUIRED", needsMigration: true }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
