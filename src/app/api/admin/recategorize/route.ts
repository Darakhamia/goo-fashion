/**
 * One-off backfill: re-run the current category classifier over products that
 * are already stored in the database.
 *
 * The import-time category fix (shared `matchCategory` keyword table) only
 * affects NEW imports — rows written before it shipped keep whatever category
 * they were given, which is why the "accessories" bucket is still full of
 * shorts / dresses / vests / knitwear. This route re-classifies existing rows
 * from their name + description using the exact same `matchCategory`, so the
 * catalog is consistent with how new imports are now categorised.
 *
 * Safety:
 *   - Read-only by default. GET, or POST without `apply:true`, is a DRY RUN:
 *     it reports what WOULD change and writes nothing.
 *   - Only rows where the classifier is confident (`matchCategory` returns a
 *     non-null category) AND that category differs are proposed — a row is
 *     never pushed back into "accessories" by this job.
 *   - `scope` defaults to "accessories" (only re-bucket rows currently sitting
 *     in accessories — the reported problem, lowest risk). Pass "all" to
 *     re-evaluate the whole catalog.
 *
 * Trigger (must be signed in as an admin):
 *   GET  /api/admin/recategorize                 → dry run, scope=accessories
 *   GET  /api/admin/recategorize?scope=all       → dry run over everything
 *   POST /api/admin/recategorize  { "apply": true }              → apply, scope=accessories
 *   POST /api/admin/recategorize  { "apply": true, "scope": "all" } → apply everywhere
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { matchCategory } from "@/lib/server/product-fields";

export const dynamic = "force-dynamic";

type Scope = "accessories" | "all";
type Row = { id: string; name: string; description: string | null; category: string };
type Change = { id: string; name: string; from: string; to: string };

const PAGE = 1000;

async function fetchAll(scope: Scope): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase!
      .from("products")
      .select("id, name, description, category")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (scope === "accessories") q = q.eq("category", "accessories");
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

async function run(apply: boolean, scope: Scope) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const rows = await fetchAll(scope);

  const changes: Change[] = [];
  // Rows the classifier can't move (no keyword matched, or it resolves to the
  // same category). Surfaced so we can see WHICH names still slip through and
  // extend the keyword table for them.
  const stuck: { name: string; category: string }[] = [];
  for (const r of rows) {
    const text = `${r.name ?? ""} ${r.description ?? ""}`.trim();
    const next = text ? matchCategory(text) : null;
    // Only act on a confident, different classification — never re-dump to accessories.
    if (next && next !== r.category) {
      changes.push({ id: r.id, name: r.name, from: r.category, to: next });
    } else {
      stuck.push({ name: r.name, category: r.category });
    }
  }

  // Breakdown of "from → to" so the dry run is easy to eyeball.
  const breakdown: Record<string, number> = {};
  for (const c of changes) {
    const key = `${c.from} → ${c.to}`;
    breakdown[key] = (breakdown[key] ?? 0) + 1;
  }

  let applied = 0;
  const failures: { id: string; error: string }[] = [];
  if (apply) {
    for (const c of changes) {
      const { error } = await supabase.from("products").update({ category: c.to }).eq("id", c.id);
      if (error) failures.push({ id: c.id, error: error.message });
      else applied++;
    }
    if (applied > 0) {
      // Refresh the pages that read categories so the UI reflects the change.
      for (const p of ["/browse", "/builder"]) {
        try { revalidatePath(p); } catch { /* best-effort */ }
      }
    }
  }

  return NextResponse.json({
    mode: apply ? "apply" : "dry-run",
    scope,
    scanned: rows.length,
    wouldChange: changes.length,
    applied: apply ? applied : 0,
    failures,
    breakdown,
    // A capped sample so the response stays readable on large catalogs.
    sample: changes.slice(0, 100),
    stillStuck: stuck.length,
    stuckSample: stuck.slice(0, 100),
  });
}

function parseScope(v: unknown): Scope {
  return v === "all" ? "all" : "accessories";
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = parseScope(new URL(req.url).searchParams.get("scope"));
  return run(false, scope);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const scope = parseScope(body?.scope ?? new URL(req.url).searchParams.get("scope"));
  const apply = body?.apply === true;
  return run(apply, scope);
}
