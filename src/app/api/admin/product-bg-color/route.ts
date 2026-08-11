/**
 * Measures the backdrop each product photo was shot on and stores it, so cards
 * can pad with that colour instead of with their own background.
 *
 * This job downloads images, which makes it unlike every other maintenance job
 * here: it is bound by the network, not by the database. Three consequences
 * shape the design.
 *
 *   It runs in batches and is resumable. Each call takes the next `limit`
 *   products that have never been measured, and stops starting new photos once
 *   its time budget is spent — so a batch never exceeds the request limit
 *   mid-write and lose everything it had measured.
 *
 *   It asks Storage for a small rendition rather than the photo. A catalogue
 *   photo is ~800 KB; the same photo at 600px is ~25 KB, and the four corners
 *   read the same either way. That is thirty times less to download, and it is
 *   the difference between a backfill measured in minutes and one in hours.
 *
 *   Parallelism is per host, not global. One rate-limited retailer CDN in the
 *   batch must not throttle the hundreds of photos sitting in our own bucket.
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
import {
  sampleBackgroundColor, urlToSample, pooledByHost, DECLINED, type HostJob,
} from "@/lib/server/bg-color";
import { isAlreadyMirrored } from "@/lib/server/storage/product-images";

export const dynamic = "force-dynamic";
// Downloading images is slow by nature; a full batch needs longer than the
// platform's default for a serverless route. TIME_BUDGET_MS stops sampling
// comfortably inside this, so the writes always get their turn.
export const maxDuration = 300;

type Row = { id: string; name: string; image_url: string | null; images: string[] | null; bg_color: string | null };
type Measured = { id: string; name: string; color: string; reason: string };
type Failed = { id: string; name: string; reason: string };

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

/**
 * How long sampling may run before it stops starting new photos.
 *
 * Writes happen after sampling, so a run that exceeds the platform's limit
 * mid-flight would lose everything it had measured. Stopping early instead means
 * whatever was measured gets written and the rest stays NULL for the next call —
 * which is what makes a limit of a thousand safe to offer even on a slow link.
 */
const TIME_BUDGET_MS = 200_000;

type Job = HostJob & { row: Row; url: string };

/**
 * Raised when the database has not run migration 015, so `bg_color` is not a
 * column yet.
 *
 * This needs its own error because of how the counting queries fail without it.
 * A filter on a column PostgREST has never heard of comes back with `count`
 * null, and reading that as zero turns "the migration has not been run" into
 * "nothing is unmeasured" — i.e. the job cheerfully reports the whole catalogue
 * as finished while every card still renders white. The failure has to be
 * carried, not defaulted.
 */
class NotMigrated extends Error {
  constructor(detail: string) {
    super(
      "products.bg_color does not exist yet — run supabase/migrations/015_product_bg_color.sql " +
      `against the database, then reload PostgREST's schema cache. (${detail})`,
    );
  }
}

/** PostgREST codes for "that column is not in my schema": select, then write. */
const UNKNOWN_COLUMN = new Set(["42703", "PGRST204"]);

function asMissingColumn(error: { code?: string; message?: string } | null): NotMigrated | null {
  if (!error) return null;
  const mentionsColumn = /bg_color/.test(error.message ?? "");
  if (UNKNOWN_COLUMN.has(error.code ?? "") && mentionsColumn) return new NotMigrated(error.message ?? "");
  // A stale schema cache reports the column as unknown without a code we can
  // match on, so the message is the only signal left.
  if (mentionsColumn && /does not exist|schema cache/i.test(error.message ?? "")) {
    return new NotMigrated(error.message ?? "");
  }
  return null;
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

  const failure = [all, unset, refused].find((r) => r.error)?.error ?? null;
  if (failure) throw asMissingColumn(failure) ?? new Error(failure.message);

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
  if (error) {
    const notMigrated = asMissingColumn(error);
    if (notMigrated) return NextResponse.json({ error: notMigrated.message }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as Row[];

  const measured: Measured[] = [];
  const declined: Measured[] = [];
  const failed: Failed[] = [];
  let viaThumbnail = 0;
  let ranOutOfTime = 0;

  const jobs: Job[] = rows.map((row) => {
    const url = urlToSample(row);
    let host = "";
    let own = false;
    try {
      host = new URL(url).host;
      own = isAlreadyMirrored(url);
    } catch {
      // No usable URL: keep it in a lane of its own so it fails immediately
      // instead of being grouped with real hosts.
      host = `unusable:${row.id}`;
    }
    return { row, url, host, own };
  });

  const deadline = Date.now() + TIME_BUDGET_MS;

  await pooledByHost(jobs, async ({ row, url }) => {
    if (Date.now() > deadline) {
      // Out of budget. Not an error and not a verdict — the row is simply left
      // for the next call, which is why this is safe to do mid-batch.
      ranOutOfTime++;
      return;
    }
    const result = await sampleBackgroundColor(url);
    if (result.via === "thumbnail") viaThumbnail++;
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
    // Grouped by value so a batch of a thousand is a handful of statements
    // rather than a thousand round trips. There are only ever a few dozen
    // distinct backdrops across a whole catalogue.
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
    // Non-zero means the batch was larger than the time budget allowed. The
    // remainder is untouched and the next call picks it up.
    ranOutOfTime,
    // How many photos arrived as a small rendition. Zero across a whole batch
    // means Storage is not serving them and every photo came at full size —
    // which is the answer to "why is this still slow".
    viaThumbnail,
    applied: opts.apply ? applied : 0,
    // False after an apply means the run was not recorded and cannot be
    // reversed from here — worth saying rather than discovering later.
    undoable: opts.apply ? undoable : null,
    writeFailures,
    // The write above just succeeded, so a failure here is not the migration —
    // report the run rather than losing it to a broken progress count.
    progress: await progress().catch(() => null),
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
  try {
    return NextResponse.json({ mode: "progress", progress: await progress() });
  } catch (e) {
    // 503 rather than 500: the code is fine, the database is behind it.
    const migration = e instanceof NotMigrated;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not read progress" },
      { status: migration ? 503 : 500 },
    );
  }
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
