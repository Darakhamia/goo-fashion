import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";

const MIGRATION_COLUMNS = ["variant_group_id", "color_hex", "is_group_primary"];

function isMissingColumnError(msg: string) {
  return (
    MIGRATION_COLUMNS.some((col) => msg.includes(col)) &&
    (msg.includes("Could not find") || msg.includes("column") || msg.includes("schema cache"))
  );
}

/** GET — check whether the variant columns exist in the DB schema */
export async function GET() {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ migrated: false, configured: false });
  }

  const { error } = await supabase
    .from("products")
    .select("id, variant_group_id, color_hex, is_group_primary")
    .limit(1);

  if (error && isMissingColumnError(error.message)) {
    return NextResponse.json({ migrated: false, error: error.message });
  }

  return NextResponse.json({ migrated: true });
}

/**
 * POST — two modes:
 *   { action: "migrate" }  → attempt to add missing columns via RPC
 *   { ids, primaryId, colorHexMap, groupId? } → link products as color variants
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const body = await req.json();

  // ── Auto-migration via Supabase RPC ──────────────────────────────────────
  if (body.action === "migrate") {
    const statements = [
      `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant_group_id text DEFAULT NULL`,
      `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color_hex text DEFAULT NULL`,
      `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_group_primary boolean DEFAULT FALSE`,
    ];

    const rpcErrors: string[] = [];
    for (const sql of statements) {
      const { error } = await supabase.rpc("run_sql", { query: sql });
      if (error && !error.message.toLowerCase().includes("already exists")) {
        rpcErrors.push(error.message);
      }
    }

    if (rpcErrors.length) {
      return NextResponse.json(
        { error: "auto-migration-failed", details: rpcErrors, needsMigration: true },
        { status: 500 }
      );
    }

    return NextResponse.json({ migrated: true });
  }

  // ── Normal grouping operation ─────────────────────────────────────────────
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

    if (errorMessages.some(isMissingColumnError)) {
      return NextResponse.json({ error: "MIGRATION_REQUIRED", needsMigration: true }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Some products could not be updated.", details: errorMessages },
      { status: 500 }
    );
  }

  return NextResponse.json({ groupId, updated: ids.length });
}

/** DELETE — unlink all products in a variant group */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (isMissingColumnError(error.message)) {
      return NextResponse.json({ error: "MIGRATION_REQUIRED", needsMigration: true }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
