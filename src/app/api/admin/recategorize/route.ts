/**
 * Re-runs the category classifier over products already in the database, for
 * rows that were imported before the keyword table knew how to place them.
 *
 * The safety here is structural rather than careful. This job cannot improve on
 * a human's judgement, so it is not allowed to overrule one:
 *
 *   - A product with a subcategory was filed by hand. Its category follows from
 *     the category tree, not from a keyword guess, so it is skipped outright.
 *     On a catalogue that has been worked through, that means this job does
 *     nothing at all — which is the correct outcome, not a failure.
 *   - A product in a category value outside the built-in list sits somewhere an
 *     admin invented. The classifier has never heard of it and cannot judge it,
 *     so it is left alone.
 *
 * On top of that: GET (or POST without `apply`) is a dry run that writes
 * nothing, and every applied run records what it changed so it can be undone.
 *
 * Classification reads the NAME only. Measured on held-out products, name-only
 * scores 92% against 88% for name-and-description: descriptions are marketing
 * copy that name-drops other garments, and a keyword table cannot tell "pairs
 * well with shorts" from "is shorts".
 *
 *   GET  /api/admin/recategorize?scope=all          → dry run
 *   POST /api/admin/recategorize {apply:true, scope:"all"}  → apply
 *   POST /api/admin/recategorize {undo:true}        → revert the last applied run (once)
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { matchCategory } from "@/lib/server/product-fields";
import { isBuiltInBucket } from "@/lib/categories";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Scope = "accessories" | "all";
type Row = { id: string; name: string; description: string | null; category: string; subcategory: string | null };
type Change = { id: string; name: string; from: string; to: string };
type Skip = { id: string; name: string; category: string; reason: SkipReason };

type SkipReason = "hand-filed" | "custom-category";

const SKIP_EXPLANATION: Record<SkipReason, string> = {
  "hand-filed": "has a subcategory — filed by hand, so the category tree decides its category",
  "custom-category": "sits in a category value the classifier does not know",
};

const PAGE = 1000;
/** Ids per `.in()` filter, so a write's query string stays well under URL limits. */
const CHUNK = 200;

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

async function fetchAll(scope: Scope): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase!
      .from("products")
      .select("id, name, description, category, subcategory")
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

/** Records an applied run so it can be reversed. Undo is only offered if this works. */
async function recordRun(
  adminId: string,
  scope: Scope,
  changes: Change[],
): Promise<boolean> {
  const { error } = await supabase!.from("admin_audit_log").insert({
    admin_id: adminId,
    action: "products.recategorized",
    target_type: "products",
    metadata: { scope, changes: changes.map((c) => ({ id: c.id, from: c.from, to: c.to })) },
  });
  return !error;
}

async function run(apply: boolean, scope: Scope, adminId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const rows = await fetchAll(scope);

  const changes: Change[] = [];
  const skipped: Skip[] = [];
  // Rows the classifier can't move: no keyword matched, or it agrees with the
  // category already stored. Surfaced so the names that still slip through are
  // visible and the keyword table can be extended for them.
  const stuck: { name: string; category: string }[] = [];

  for (const r of rows) {
    if (r.subcategory) {
      skipped.push({ id: r.id, name: r.name, category: r.category, reason: "hand-filed" });
      continue;
    }
    if (r.category && !isBuiltInBucket(r.category)) {
      skipped.push({ id: r.id, name: r.name, category: r.category, reason: "custom-category" });
      continue;
    }
    const next = r.name ? matchCategory(r.name) : null;
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

  const skippedBreakdown = Object.entries(SKIP_EXPLANATION).map(([reason, explanation]) => ({
    reason,
    explanation,
    count: skipped.filter((s) => s.reason === reason).length,
  }));

  let applied = 0;
  let undoable = false;
  const failures: { id: string; error: string }[] = [];
  if (apply) {
    // One write per target category rather than one per product: a run is a
    // handful of distinct moves spread over many rows.
    const byTarget = new Map<string, Change[]>();
    for (const c of changes) byTarget.set(c.to, [...(byTarget.get(c.to) ?? []), c]);
    const written: Change[] = [];
    for (const [to, list] of byTarget) {
      for (const chunk of chunks(list)) {
        const { error } = await supabase.from("products").update({ category: to }).in("id", chunk.map((c) => c.id));
        if (error) failures.push(...chunk.map((c) => ({ id: c.id, error: error.message })));
        else written.push(...chunk);
      }
    }
    applied = written.length;
    if (applied > 0) {
      undoable = await recordRun(adminId, scope, written);
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
    protected: skipped.length,
    skippedBreakdown,
    wouldChange: changes.length,
    applied: apply ? applied : 0,
    // False after an apply means the run was not recorded and cannot be
    // reverted from here — worth saying out loud rather than discovering later.
    undoable: apply ? undoable : null,
    failures,
    breakdown,
    // A capped sample so the response stays readable on large catalogues.
    sample: changes.slice(0, 100),
    stillStuck: stuck.length,
    stuckSample: stuck.slice(0, 100),
  });
}

/**
 * Puts back what the last applied run changed.
 *
 * A row is only restored when it still holds the value that run wrote. Anything
 * edited since is left alone and counted separately: undo is for reversing this
 * job, not for overwriting whatever happened afterwards.
 */
async function undo(adminId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, created_at, metadata")
    .eq("action", "products.recategorized")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json(
      { error: `Could not read the audit log, so there is nothing to undo from: ${error.message}` },
      { status: 503 },
    );
  }
  const entry = (data ?? [])[0] as { id: number; created_at: string; metadata: { changes?: Change[] } } | undefined;
  const changes = entry?.metadata?.changes ?? [];
  if (!entry || !changes.length) {
    return NextResponse.json({ error: "No recategorize run to undo." }, { status: 404 });
  }

  // Undo reverses the last run once. A second press would restore nothing and
  // still write a journal entry saying it had.
  const undone = await supabase
    .from("admin_audit_log")
    .select("id")
    .eq("action", "products.recategorize_undone")
    .gt("created_at", entry.created_at)
    .limit(1);
  if (undone.error) {
    return NextResponse.json(
      { error: `Could not check whether the last run was already undone: ${undone.error.message}` },
      { status: 503 },
    );
  }
  if ((undone.data ?? []).length) {
    return NextResponse.json({ error: "The last category fix has already been undone." }, { status: 409 });
  }

  let restored = 0;
  let movedSince = 0;
  const failures: { id: string; error: string }[] = [];

  // Current categories in one read per chunk rather than one per product.
  const current = new Map<string, string>();
  const unread = new Set<string>();
  for (const ids of chunks(changes.map((c) => c.id))) {
    const { data: rows, error: readError } = await supabase.from("products").select("id, category").in("id", ids);
    if (readError) {
      for (const id of ids) {
        unread.add(id);
        failures.push({ id, error: readError.message });
      }
      continue;
    }
    for (const r of (rows ?? []) as { id: string; category: string }[]) current.set(String(r.id), r.category);
  }

  // Grouped by move, and each write matches only rows still holding what the
  // run wrote, so an edit landing between the read and the write is left alone.
  const byMove = new Map<string, { from: string; to: string; ids: string[] }>();
  for (const c of changes) {
    if (unread.has(c.id) || !current.has(c.id)) continue;
    if (current.get(c.id) !== c.to) { movedSince++; continue; }
    const key = `${c.from}\u0000${c.to}`;
    const move = byMove.get(key) ?? { from: c.from, to: c.to, ids: [] };
    move.ids.push(c.id);
    byMove.set(key, move);
  }
  for (const { from, to, ids } of byMove.values()) {
    for (const chunk of chunks(ids)) {
      const { data: rows, error: writeError } = await supabase
        .from("products")
        .update({ category: from })
        .in("id", chunk)
        .eq("category", to)
        .select("id");
      if (writeError) {
        failures.push(...chunk.map((id) => ({ id, error: writeError.message })));
        continue;
      }
      const n = (rows ?? []).length;
      restored += n;
      movedSince += chunk.length - n;
    }
  }

  // The run counts as undone only once every product was read and written. With
  // failures it stays open, so pressing Undo again retries them: rows already
  // restored no longer hold what the run wrote and are skipped.
  if (failures.length === 0) {
    await supabase.from("admin_audit_log").insert({
      admin_id: adminId,
      action: "products.recategorize_undone",
      target_type: "products",
      metadata: { undid_run_at: entry.created_at, restored, movedSince },
    });
  }

  for (const p of ["/browse", "/builder"]) {
    try { revalidatePath(p); } catch { /* best-effort */ }
  }

  return NextResponse.json({ mode: "undo", ranAt: entry.created_at, restored, movedSince, failures });
}

function parseScope(v: unknown): Scope {
  return v === "all" ? "all" : "accessories";
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = parseScope(new URL(req.url).searchParams.get("scope"));
  return run(false, scope, admin.userId);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body?.undo === true) return undo(admin.userId);
  const scope = parseScope(body?.scope ?? new URL(req.url).searchParams.get("scope"));
  const apply = body?.apply === true;
  return run(apply, scope, admin.userId);
}
