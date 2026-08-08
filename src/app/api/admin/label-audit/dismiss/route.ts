/**
 * Records that an audit suggestion was rejected, so it stops coming back.
 *
 * Some of what the audit says is wrong — "Bomber Jackets" is more precise than
 * the "Jackets" a rule suggests, and a rule that learned "smith" from Stan
 * Smith trainers will argue a Paul Smith shirt is footwear. Judging one of
 * those is work, and without somewhere to keep the answer it is work repeated
 * on every run until the real findings are lost in it.
 *
 * A dismissal covers one claim, not one product: this field, holding this
 * value, suggested to become that one. Change the stored value later and the
 * old claim no longer applies, so the audit is free to raise whatever is true
 * of the new one.
 *
 *   POST   → dismiss  { id, field, stored, suggested }
 *   DELETE → restore  ?id=…&field=…&stored=…&suggested=…
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Postgres undefined_table, and PostgREST's "no such table in schema cache". */
function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    !!error.message?.includes("does not exist")
  );
}

function tableMissing() {
  return NextResponse.json(
    {
      error: "Dismissals table not found. Run migration 012.",
      code: "TABLE_MISSING",
    },
    { status: 503 },
  );
}

interface Claim {
  product_id: string;
  field: string;
  stored: string;
  suggested: string;
}

function readClaim(source: { get(key: string): string | null } | Record<string, unknown>): Claim | null {
  const read = (key: string): string =>
    typeof (source as { get?: unknown }).get === "function"
      ? String((source as { get(k: string): string | null }).get(key) ?? "")
      : String((source as Record<string, unknown>)[key] ?? "");

  const product_id = read("id").trim();
  const field = read("field").trim();
  if (!product_id || !field) return null;
  // Both sides of the claim default to empty rather than null, so the unique
  // constraint can hold: in Postgres two nulls never conflict, which would let
  // the same dismissal be stored over and over.
  return { product_id, field, stored: read("stored"), suggested: read("suggested") };
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const claim = readClaim(await req.json().catch(() => ({})));
  if (!claim) return NextResponse.json({ error: "Need a product and a field." }, { status: 400 });

  const { error } = await supabase
    .from("label_audit_dismissals")
    .upsert({ ...claim, dismissed_by: admin.userId }, { onConflict: "product_id,field,stored,suggested" });
  if (error) {
    if (isTableMissing(error)) return tableMissing();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, dismissed: claim });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const claim = readClaim(new URL(req.url).searchParams);
  if (!claim) return NextResponse.json({ error: "Need a product and a field." }, { status: 400 });

  const { error } = await supabase
    .from("label_audit_dismissals")
    .delete()
    .eq("product_id", claim.product_id)
    .eq("field", claim.field)
    .eq("stored", claim.stored)
    .eq("suggested", claim.suggested);
  if (error) {
    if (isTableMissing(error)) return tableMissing();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, restored: claim });
}
