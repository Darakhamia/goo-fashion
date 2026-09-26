import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { isMissingTable, MISSING_COLUMN_CODES } from "@/lib/server/retailer-domains";

// The default brand list lives in supabase-schema.sql alone: an unreachable or
// missing table is reported as an error, never papered over with a stand-in list.
const TABLE_MISSING_MESSAGE =
  "The brands table does not exist yet — run the brands section of supabase-schema.sql (and supabase-migration-brand-logos.sql for logos), then reload this page.";

/**
 * A failed read of the list. The route is public, so the database's own message
 * goes to the log and to admins only; anyone else gets a plain one.
 */
async function readFailed(message: string) {
  console.error("[api/brands] list:", message);
  const admin = await requireAdmin();
  return NextResponse.json(
    { error: admin ? `Could not load brands: ${message}` : "Could not load brands." },
    { status: 500 },
  );
}

export async function GET() {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured.", code: "NO_DB" }, { status: 503 });
  }
  // Prefer name + logo_url; fall back to name-only if the logo_url column
  // hasn't been added yet (supabase-migration-brand-logos.sql not run).
  type BrandRow = { name: string; logo_url?: string | null };
  let rows: BrandRow[] = [];
  const withLogo = await supabase
    .from("brands")
    .select("name, logo_url")
    .order("name", { ascending: true });
  if (!withLogo.error) {
    rows = (withLogo.data ?? []) as BrandRow[];
  } else if (withLogo.error.code && MISSING_COLUMN_CODES.has(withLogo.error.code)) {
    const nameOnly = await supabase
      .from("brands")
      .select("name")
      .order("name", { ascending: true });
    if (nameOnly.error) return readFailed(nameOnly.error.message);
    rows = (nameOnly.data ?? []) as BrandRow[];
  } else if (isMissingTable(withLogo.error)) {
    return NextResponse.json({ error: TABLE_MISSING_MESSAGE, code: "TABLE_MISSING" }, { status: 503 });
  } else {
    return readFailed(withLogo.error.message);
  }

  return NextResponse.json(rows.map((r) => ({ name: r.name, logoUrl: r.logo_url ?? null })));
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured.", code: "NO_DB" }, { status: 501 });
  }
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("brands")
    .insert({ name: name.trim() })
    .select("name")
    .single();
  if (error) {
    // Postgres 42P01 or PostgREST's schema-cache miss (PGRST205)
    if (isMissingTable(error)) {
      return NextResponse.json({ error: TABLE_MISSING_MESSAGE, code: "TABLE_MISSING" }, { status: 503 });
    }
    // unique_violation: the name is already there (e.g. a double submit)
    if (error.code === "23505") {
      return NextResponse.json({ error: "Brand already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await logAdminAction({
    admin_id: admin.userId,
    action: "brands.created",
    target_id: data.name,
    target_type: "brand",
    metadata: { name: data.name },
  });
  return NextResponse.json(data, { status: 201 });
}
