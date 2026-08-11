/**
 * Measures the backdrop each product photo was shot on and stores it, so cards
 * can pad with that colour instead of with their own background.
 *
 * This job downloads images, which makes it unlike every other maintenance job
 * here: it is bound by the network, not by the database. Three consequences
 * shape the design.
 *
 *   It runs in batches and is resumable. Each call takes the next `limit`
 *   products that have never been measured. A catalogue is worked through by
 *   calling it again, not by waiting longer — a single pass over ten thousand
 *   photos would exceed any request timeout.
 *
 *   Judged-and-declined is recorded as 'none', not as null. Without that
 *   distinction every re-run would re-download the photos it had already
 *   decided against, and the job would never converge.
 *
 *   A download that fails leaves the row untouched, so the next run retries it.
 *   Retailer CDNs answer our server with 429 by design; a rate-limited photo is
 *   a "come back later", not a verdict.
 *
 * The measurement itself is in lib/server/bg-color, along with why it samples
 * corners rather than computing a dominant colour.
 *
 *   GET  /api/admin/product-bg-color                     → progress, writes nothing
 *   POST /api/admin/product-bg-color {limit}              → dry run over the next batch
 *   POST /api/admin/product-bg-color {limit, apply:true}  → measure and store
 *   POST /api/admin/product-bg-color {ids:[…], apply}     → re-measure named products
 *   POST /api/admin/product-bg-color {undo:true}          → clear what the last run wrote
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sampleBackgroundColor, urlToSample, DECLINED } from "@/lib/server/bg-color";

export const dynamic = "force-dynamic";
// Downloading images is slow by nature; a batch of 300 needs longer than the
// platform's default for a serverless route.
export const maxDuration = 300;

type Row = { id: string; name: string; image_url: string | null; images: string[] | null; bg_color: string | null };
type Measured = { id: string; name: string; color: string; reason: string };
type Failed = { id: string; name: string; reason: string };

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 300;

/**
 * How many photos are in flight at once.
 *
 * Four, because imports mirror photos into our own storage, so in practice this
 * is four parallel requests to our own bucket. The exception — legacy rows that
 * still hotlink a retailer — is why failures are recoverable rather than final:
 * if a CDN rate-limits four at a time, those rows stay unmeasured and the next
 * run picks them up.
 */
const CONCURRENCY = 4;

/** Run `worker` over `items`, `CONCURRENCY` at a time, preserving nothing but order of completion. */
async function pooled<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const mine = items[next++];
      await worker(mine);
    }
  });
  await Promise.all(lanes);
}

/** How far through the catalogue the job is, so a batch button can show it. */
async function progress() {
  const sb = supabase!;
  const heads = () => sb.from("products").select("id", { count: "exact", head: true });
  const [all, unset, refused] = await Promise.all([
    heads(),
    heads().is("bg_color", null),
    heads().eq("bg_color", DECLINED),
  ]);

  const total = all.count ?? 0;
  const unmeasured = unset.count ?? 0;
  const declined = refused.count ?? 0;
  return { total, unmeasured, declined, measured: total - unmeasured - declined };
}

async function run(opts: { apply: boolean; limit: number; ids: string[]; adminId: string }) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Named ids are re-measured whatever they currently hold — that is the point
  // of naming them (a photo was replaced, or a threshold changed). Otherwise
  // take the never-measured rows, oldest first, so repeated calls march
  // forward instead of re-treading the same batch.
  let query = supabase
    .from("products")
    .select("id, name, image_url, images, bg_color");
  query = opts.ids.length
    ? query.in("id", opts.ids)
    : query.is("bg_color", null).order("created_at", { ascending: true }).limit(opts.limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as Row[];

  const measured: Measured[] = [];
  const declined: Measured[] = [];
  const failed: Failed[] = [];

  await pooled(rows, async (row) => {
    const result = await sampleBackgroundColor(urlToSample(row));
    if (result.outcome === "measured" && result.color) {
      measured.push({ id: row.id, name: row.name, color: result.color, reason: result.reason });
    } else if (result.outcome === "unavailable") {
      // The photo was never seen — a 429, a dead URL, a missing decoder. Leave
      // the row alone so the next run tries again rather than recording a
      // verdict on something we did not look at.
      failed.push({ id: row.id, name: row.name, reason: result.reason });
    } else {
      declined.push({ id: row.id, name: row.name, color: DECLINED, reason: result.reason });
    }
  });

  let applied = 0;
  let undoable = false;
  const writeFailures: { id: string; error: string }[] = [];

  if (opts.apply) {
    const writes = [...measured, ...declined];
    // Grouped by value so a batch of 300 is a handful of statements rather than
    // 300 round trips. There are only ever a few dozen distinct backdrops.
    const byColor = new Map<string, string[]>();
    for (const w of writes) {
      const list = byColor.get(w.color) ?? [];
      list.push(w.id);
      byColor.set(w.color, list);
    }
    for (const [color, ids] of byColor) {
      const { data: written, error: writeError } = await supabase
        .from("products")
        .update({ bg_color: color })
        .in("id", ids)
        .select("id");
      if (writeError) {
        for (const id of ids) writeFailures.push({ id, error: writeError.message });
      } else {
        applied += (written ?? []).length;
      }
    }

    if (applied > 0) {
      const { error: logError } = await supabase.from("admin_audit_log").insert({
        admin_id: opts.adminId,
        action: "products.bg_color_sampled",
        target_type: "products",
        metadata: {
          resampled: opts.ids.length > 0,
          // Enough to reverse the run: what each row held before, and what it
          // was given. Kept to ids and colours so the entry stays small.
          changes: writes
            .filter((w) => !writeFailures.some((f) => f.id === w.id))
            .map((w) => ({
              id: w.id,
              from: rows.find((r) => r.id === w.id)?.bg_color ?? null,
              to: w.color,
            })),
        },
      });
      undoable = !logError;
      for (const p of ["/browse", "/builder"]) {
        try { revalidatePath(p); } catch { /* best-effort */ }
      }
    }
  }

  return NextResponse.json({
    mode: opts.apply ? "apply" : "dry-run",
    scanned: rows.length,
    measured: measured.length,
    declined: declined.length,
    failed: failed.length,
    applied: opts.apply ? applied : 0,
    // False after an apply means the run was not recorded and cannot be
    // reversed from here — worth saying rather than discovering later.
    undoable: opts.apply ? undoable : null,
    writeFailures,
    progress: await progress(),
    // Capped samples so the response stays readable on a large catalogue.
    measuredSample: measured.slice(0, 60),
    declinedSample: declined.slice(0, 60),
    failedSample: failed.slice(0, 60),
  });
}

/**
 * Clears what the last applied run wrote.
 *
 * A row is only cleared when it still holds that run's value; anything changed
 * since is counted separately and left alone. Same rule as the recategorize
 * undo — this reverses one job, it does not overwrite what came after it.
 */
async function undo(adminId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, created_at, metadata")
    .eq("action", "products.bg_color_sampled")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json(
      { error: `Could not read the audit log, so there is nothing to undo from: ${error.message}` },
      { status: 503 },
    );
  }

  const entry = (data ?? [])[0] as
    | { created_at: string; metadata: { changes?: { id: string; from: string | null; to: string }[] } }
    | undefined;
  const changes = entry?.metadata?.changes ?? [];
  if (!changes.length) return NextResponse.json({ error: "No sampling run to undo." }, { status: 404 });

  let restored = 0;
  let changedSince = 0;
  const failures: { id: string; error: string }[] = [];

  for (const c of changes) {
    const { data: current, error: readError } = await supabase
      .from("products")
      .select("bg_color")
      .eq("id", c.id)
      .limit(1);
    if (readError) { failures.push({ id: c.id, error: readError.message }); continue; }
    const row = (current ?? [])[0] as { bg_color: string | null } | undefined;
    if (!row) continue;
    if (row.bg_color !== c.to) { changedSince++; continue; }

    const { error: writeError } = await supabase
      .from("products")
      .update({ bg_color: c.from })
      .eq("id", c.id);
    if (writeError) failures.push({ id: c.id, error: writeError.message });
    else restored++;
  }

  await supabase.from("admin_audit_log").insert({
    admin_id: adminId,
    action: "products.bg_color_undone",
    target_type: "products",
    metadata: { undid_run_at: entry?.created_at, restored, changedSince },
  });

  for (const p of ["/browse", "/builder"]) {
    try { revalidatePath(p); } catch { /* best-effort */ }
  }

  return NextResponse.json({ mode: "undo", ranAt: entry?.created_at, restored, changedSince, failures });
}

function parseLimit(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  return NextResponse.json({ mode: "progress", progress: await progress() });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    apply?: unknown; limit?: unknown; ids?: unknown; undo?: unknown;
  };
  if (body.undo === true) return undo(admin.userId);

  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean).slice(0, MAX_LIMIT) : [];
  return run({ apply: body.apply === true, limit: parseLimit(body.limit), ids, adminId: admin.userId });
}
