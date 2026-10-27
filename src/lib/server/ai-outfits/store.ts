/**
 * AI outfit runs in the database: started by the studio, carried out in the
 * background, followed by the studio until they end.
 *
 * A run takes minutes — one picture per outfit — so the request that starts it
 * answers at once and the work continues after it (`after()` in the route).
 * Progress goes to `ai_outfit_runs` (migration 031) as it happens; the studio
 * reads it every few seconds. A run whose row has not moved for a quarter of
 * an hour was cut short (the server restarted) and is shown as such.
 */
import { supabase } from "@/lib/supabase";
import { getAllColorGroups, readAllProducts } from "@/lib/data/db";
import { isMissingTable } from "@/lib/server/db-errors";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { toUsd } from "@/lib/server/fx";
import { generateOutfitImage } from "@/lib/server/outfit-image";
import { writeRowDroppingUnknown } from "@/lib/server/write-row";
import { legacySeason } from "@/lib/seasons";
import { OUTFIT_MODEL, planOutfits } from "./model";
import { runGeneration, signatureOf, type QueuedLook, type RunInput } from "./run";

export const RUNS_TABLE = "ai_outfit_runs";
/** A running run not heard from for this long was cut short. */
const STALE_MS = 15 * 60_000;
/** Lines of the log kept per run. */
const LOG_LINES = 200;

export interface RunLogLine {
  at: string;
  message: string;
}

export interface RunRow {
  id: string;
  created_by: string;
  brief: RunInput;
  status: "running" | "done" | "failed";
  requested: number;
  made: number;
  failed: number;
  log: RunLogLine[];
  cost_usd: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

const isStale = (row: RunRow) => row.status === "running" && Date.now() - Date.parse(row.updated_at) > STALE_MS;

/** The latest runs, newest first; one cut short is recorded as failed on the way. */
export async function listRuns(limit = 5): Promise<{ runs: RunRow[]; tableMissing: boolean; error?: string }> {
  if (!supabase) return { runs: [], tableMissing: false };
  const { data, error } = await supabase.from(RUNS_TABLE).select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) return { runs: [], tableMissing: isMissingTable(error), error: error.message };
  const runs = (data ?? []) as RunRow[];
  for (const row of runs.filter(isStale)) {
    const error = "Interrupted: the server restarted while the run was in progress.";
    await supabase.from(RUNS_TABLE).update({ status: "failed", error, finished_at: new Date().toISOString() }).eq("id", row.id);
    Object.assign(row, { status: "failed", error });
  }
  return { runs, tableMissing: false };
}

/** What a run needs that may be missing, in the words the studio shows. */
export async function readiness(): Promise<{ openai: boolean; replicate: boolean }> {
  return {
    openai: Boolean(await getOpenAIKey()),
    replicate: Boolean(process.env.REPLICATE_API_TOKEN?.trim()),
  };
}

/** Records a new run; refuses while another is still going. */
export async function startRun(adminId: string, input: RunInput): Promise<{ id: string } | { error: string; status: number }> {
  if (!supabase) return { error: "Database not configured.", status: 503 };
  const { runs, tableMissing, error } = await listRuns(1);
  if (tableMissing) return { error: "Run the pending migration 031_ai_outfit_runs.sql (it applies on deploy).", status: 503 };
  if (error) return { error, status: 500 };
  if (runs[0]?.status === "running") return { error: "A run is already in progress — wait for it to finish.", status: 409 };

  const { data, error: insertError } = await supabase
    .from(RUNS_TABLE)
    .insert({ created_by: adminId, brief: input, requested: input.count, log: [{ at: new Date().toISOString(), message: "Started." }] })
    .select("id")
    .single();
  if (insertError || !data) return { error: insertError?.message ?? "Could not start the run.", status: 500 };
  return { id: (data as { id: string }).id };
}

/** Piece sets and names the site already has: the catalogue's outfits and the queue's looks. */
async function existing(): Promise<{ signatures: Set<string>; names: Set<string> }> {
  const signatures = new Set<string>();
  const names = new Set<string>();
  if (!supabase) return { signatures, names };
  const [outfits, queue] = await Promise.all([
    supabase.from("outfits").select("name, items"),
    supabase.from("pending_looks").select("name, pieces").eq("status", "pending"),
  ]);
  for (const o of (outfits.data ?? []) as { name: string | null; items: { product_id?: string }[] | null }[]) {
    signatures.add(signatureOf((o.items ?? []).map((i) => i.product_id)));
    if (o.name) names.add(o.name.trim().toLowerCase());
  }
  for (const l of (queue.data ?? []) as { name: string | null; pieces: { productId?: string }[] | null }[]) {
    signatures.add(signatureOf((l.pieces ?? []).map((p) => p.productId)));
    if (l.name) names.add(l.name.trim().toLowerCase());
  }
  return { signatures, names };
}

/** Carries out a run to the end. Never throws: whatever goes wrong ends the run as failed, with the reason. */
export async function executeRun(runId: string, adminId: string, input: RunInput): Promise<void> {
  if (!supabase) return;
  const db = supabase;

  // The row is written whole each time, one write after another, from this
  // copy — pictures are drawn two at a time and report out of order.
  const state = { log: [] as RunLogLine[], made: 0, failed: 0, cost: 0 };
  const { data: row } = await db.from(RUNS_TABLE).select("log").eq("id", runId).maybeSingle();
  state.log = ((row as { log?: RunLogLine[] } | null)?.log ?? []).slice(-LOG_LINES);
  let writing: Promise<unknown> = Promise.resolve();
  const save = (extra: Record<string, unknown> = {}) => {
    const patch = {
      log: state.log.slice(-LOG_LINES),
      made: state.made,
      failed: state.failed,
      cost_usd: Math.round(state.cost * 10_000) / 10_000,
      updated_at: new Date().toISOString(),
      ...extra,
    };
    writing = writing.then(() => db.from(RUNS_TABLE).update(patch).eq("id", runId));
    return writing;
  };

  try {
    const [apiKey, catalogue, colorGroups, known] = await Promise.all([
      getOpenAIKey(),
      readAllProducts(true),
      getAllColorGroups(),
      existing(),
    ]);
    const apiToken = process.env.REPLICATE_API_TOKEN?.trim();
    if (!apiKey) throw new Error("No OpenAI key: add one in Settings → OpenAI API Key.");
    if (!apiToken) throw new Error("REPLICATE_API_TOKEN is not set, so pictures cannot be drawn.");
    if (catalogue.error) throw new Error(`Could not read the catalogue: ${catalogue.error}`);

    const result = await runGeneration(input, {
      runId,
      products: catalogue.products,
      colorGroups,
      existingSignatures: known.signatures,
      existingNames: known.names,
      seed: Date.now(),
      modelName: OUTFIT_MODEL,
      plan: (req) => planOutfits(req, apiKey),
      draw: (pieces, style) => generateOutfitImage({ apiToken, pieces, style, owner: adminId }),
      toUsd: async (amount, currency) => (await toUsd(amount, currency))?.usd ?? amount,
      queue: (look) => queueLook(adminId, look),
      report: async (u) => {
        if (u.message) state.log.push({ at: new Date().toISOString(), message: u.message });
        if (u.made !== undefined) state.made = u.made;
        if (u.failed !== undefined) state.failed = u.failed;
        if (u.costUsd !== undefined) state.cost += u.costUsd;
        await save();
      },
    });

    const done = result.made > 0;
    state.log.push({
      at: new Date().toISOString(),
      message: done
        ? `Done: ${result.made} outfit${result.made === 1 ? "" : "s"} in Pending${result.refused ? `, ${result.refused} refused by the checks` : ""}.`
        : `Nothing was made${result.error ? `: ${result.error}` : "."}`,
    });
    await save({ status: done ? "done" : "failed", error: done ? null : result.error ?? "Nothing was made.", finished_at: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-outfits] run ${runId} failed:`, message);
    state.log.push({ at: new Date().toISOString(), message: `Failed: ${message}` });
    await save({ status: "failed", error: message, finished_at: new Date().toISOString() });
  }
}

/** One generated look into the moderation queue, as the admin who started the run. */
async function queueLook(adminId: string, look: QueuedLook): Promise<void> {
  const { error } = await writeRowDroppingUnknown<null>(
    {
      user_id: adminId,
      status: "pending",
      look_id: null,
      ...look,
      season: legacySeason(look.seasons),
    },
    // Columns of older migrations; `ai_meta` arrives with the runs table and
    // is required — a look without it would be approved as a person's.
    ["look_id", "name", "description", "season", "seasons"],
    (payload) => supabase!.from("pending_looks").insert(payload).then(({ error: e }) => ({ data: null, error: e })),
  );
  if (error) throw new Error(error.message);
}
