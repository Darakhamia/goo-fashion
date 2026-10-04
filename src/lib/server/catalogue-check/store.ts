/**
 * The AI check against the database: settings, runs, writing fixes, undoing
 * them, and the background sweep that checks new products after each import.
 *
 * The model never touches the database. It is handed records and answers in a
 * fixed shape; `judgeFixes` decides what is allowed; this module writes only
 * that, journals every write with the columns before and after, and can put
 * any of them back.
 *
 * Three ways in:
 *   - after every import (extension, Collect catalog, Parse URL, CSV) the
 *     imported product is queued and the sweep checks it, plus any product
 *     never checked, a batch at a time, under a monthly spending cap;
 *   - "Check" in the studio walks the catalogue from the admin's tab;
 *   - "Unify brands" reviews every brand spelling the catalogue holds at once.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { loadCategoryTree } from "@/lib/server/category-tree";
import { getAllColorGroups } from "@/lib/data/db";
import { isMissingTable } from "@/lib/server/db-errors";
import { brandWords, foldBrand, isNotABrand } from "@/lib/server/parser/brand-from-name";
import {
  CHECK_COLUMNS,
  OPTIONAL_CHECK_COLUMNS,
  fingerprint,
  judgeFixes,
  needsCheck,
  productForModel,
  rowAfter,
  rowHolds,
  type CheckRow,
  type ModelFix,
  type ValidFix,
} from "./fields";
import {
  CHECK_MODELS,
  DEFAULT_CHECK_MODEL,
  NO_USAGE,
  addUsage,
  checkProductsWithModel,
  estimateCostUsd,
  isCheckModel,
  reviewBrandsWithModel,
  type BrandEntry,
  type CheckModel,
  type PromptContext,
  type Usage,
} from "./ai";

// ── Settings ─────────────────────────────────────────────────────────────────

export type CheckMode = "off" | "suggest" | "auto";

export interface CheckSettings {
  /**
   * auto — sure fixes are written, after imports and from the studio;
   * suggest — nothing is written, every fix waits for a person;
   * off — nothing runs by itself; a run from the studio still writes sure fixes.
   */
  mode: CheckMode;
  model: CheckModel;
  /** Ceiling on what the background sweep may spend in a calendar month. Manual runs are not capped. */
  monthlyBudgetUsd: number;
  /** House rules typed by the team, appended to the model's instructions. */
  notes: string;
}

const SETTINGS_KEY = "catalogue_check";
const MAX_NOTES = 2_000;
const MAX_BUDGET = 100;

export const DEFAULT_CHECK_SETTINGS: CheckSettings = {
  mode: "auto",
  model: DEFAULT_CHECK_MODEL,
  monthlyBudgetUsd: 5,
  notes: "",
};

function cleanSettings(raw: Partial<CheckSettings> | null | undefined): CheckSettings {
  const mode = raw?.mode === "off" || raw?.mode === "suggest" || raw?.mode === "auto" ? raw.mode : DEFAULT_CHECK_SETTINGS.mode;
  const model = isCheckModel(raw?.model) ? raw.model : DEFAULT_CHECK_SETTINGS.model;
  const budget = Number(raw?.monthlyBudgetUsd);
  return {
    mode,
    model,
    monthlyBudgetUsd: Number.isFinite(budget) && budget >= 0 ? Math.min(budget, MAX_BUDGET) : DEFAULT_CHECK_SETTINGS.monthlyBudgetUsd,
    notes: typeof raw?.notes === "string" ? raw.notes.slice(0, MAX_NOTES) : "",
  };
}

export async function getCheckSettings(): Promise<CheckSettings> {
  if (!supabase) return DEFAULT_CHECK_SETTINGS;
  try {
    const { data } = await supabase.from("settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    const value = (data as { value: string } | null)?.value;
    return cleanSettings(value ? (JSON.parse(value) as Partial<CheckSettings>) : null);
  } catch {
    return DEFAULT_CHECK_SETTINGS;
  }
}

export async function saveCheckSettings(next: Partial<CheckSettings>): Promise<{ settings: CheckSettings; error: string | null }> {
  const settings = cleanSettings({ ...(await getCheckSettings()), ...next });
  if (!supabase) return { settings, error: "Database not configured." };
  const { error } = await supabase
    .from("settings")
    .upsert({ key: SETTINGS_KEY, value: JSON.stringify(settings), updated_at: new Date().toISOString() }, { onConflict: "key" });
  return { settings, error: error?.message ?? null };
}

// ── Reading records ──────────────────────────────────────────────────────────

/** Narrowed for the life of the server once an optional column turns out to be missing. */
let checkColumns: string[] = [...CHECK_COLUMNS];

type Read = { data: unknown; error: { code?: string; message: string } | null };

class NotMigrated extends Error {
  constructor() {
    super("Run supabase/migrations/025_catalogue_check.sql first — the check has nowhere to record what it did.");
  }
}

/** A product read with the check's columns, dropping an optional one the database lacks. */
async function selectRows(run: (columns: string) => PromiseLike<Read>): Promise<CheckRow[]> {
  for (;;) {
    const { data, error } = await run(checkColumns.join(","));
    if (!error) return (data ?? []) as CheckRow[];
    const message = error.message ?? "";
    if (/catalogue_fingerprint|catalogue_checked_at/.test(message)) throw new NotMigrated();
    if (error.code === "42703" || error.code === "PGRST204") {
      const missing = checkColumns.find((c) => OPTIONAL_CHECK_COLUMNS.has(c) && new RegExp(`\\b${c}\\b`).test(message));
      if (missing) {
        checkColumns = checkColumns.filter((c) => c !== missing);
        continue;
      }
    }
    throw new Error(message);
  }
}

function db() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Database not configured.");
  return supabase;
}

const PAGE = 1000;
/** Ids per `.in()` filter, so a request's query string stays well under URL limits. */
const IN_CHUNK = 200;

function chunked<T>(items: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ── Context ──────────────────────────────────────────────────────────────────

type Context = PromptContext;

const CONTEXT_TTL_MS = 10 * 60_000;
let contextCache: { at: number; ctx: Omit<Context, "notes"> } | null = null;

/**
 * The catalogue around the records: the category tree, the colour filters and
 * the brand spellings in use, most used first. Kept ten minutes — reading every
 * brand is a scan of the catalogue, and none of it changes mid-run in a way
 * that matters.
 */
async function loadContext(notes: string, fresh = false): Promise<Context> {
  if (!fresh && contextCache && Date.now() - contextCache.at < CONTEXT_TTL_MS) return { ...contextCache.ctx, notes };
  const client = db();
  const [tree, groups] = await Promise.all([loadCategoryTree(), getAllColorGroups()]);

  const counts = new Map<string, number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from("products").select("brand").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { brand: string | null }[];
    for (const r of rows) {
      const brand = (r.brand ?? "").replace(/\s+/g, " ").trim();
      if (brand && !isNotABrand(brand)) counts.set(brand, (counts.get(brand) ?? 0) + 1);
    }
    if (rows.length < PAGE) break;
  }
  const { data: listed } = await client.from("brands").select("name");
  const curated = new Set(
    ((listed ?? []) as { name: string }[]).map((b) => (b.name ?? "").trim()).filter((n) => n && !isNotABrand(n)),
  );

  // One spelling per folded brand, so the model is shown "Nike", not "Nike | NIKE | nike".
  // The admin's Brands list decides the spelling; otherwise the most used one,
  // and on a tie the one written in mixed case rather than a store's ALL CAPS.
  const rank = (name: string) => [curated.has(name) ? 1 : 0, counts.get(name) ?? 0, name !== name.toLowerCase() && name !== name.toUpperCase() ? 1 : 0];
  const better = (a: string, b: string) => {
    const [x, y] = [rank(a), rank(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return a < b;
  };
  const byFold = new Map<string, { name: string; count: number }>();
  for (const name of new Set([...curated, ...counts.keys()])) {
    const key = foldBrand(name);
    const count = counts.get(name) ?? 0;
    const seen = byFold.get(key);
    if (!seen) byFold.set(key, { name, count });
    else byFold.set(key, { name: better(name, seen.name) ? name : seen.name, count: seen.count + count });
  }
  const brands = [...byFold.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((b) => b.name);

  const ctx = { tree: tree.groups, colorGroups: groups.map((g) => ({ id: g.id, name: g.name })), brands };
  contextCache = { at: Date.now(), ctx };
  return { ...ctx, notes };
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export type RunTrigger = "manual" | "auto" | "brands";

interface RunDelta {
  products: number;
  applied: number;
  suggested: number;
  failed: number;
  usage: Usage;
}

export function newRunId(trigger: RunTrigger): string {
  return `${trigger}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** The background sweep keeps one run per day, so the log is not a row per import. */
function autoRunId(): string {
  return `auto-${new Date().toISOString().slice(0, 10)}`;
}

async function addToRun(runId: string, trigger: RunTrigger, model: string, adminId: string | null, d: RunDelta): Promise<void> {
  const client = db();
  const { data } = await client.from("catalogue_check_runs").select("*").eq("id", runId).maybeSingle();
  const row = data as Record<string, number | string> | null;
  const now = new Date().toISOString();
  const sums = {
    products: Number(row?.products ?? 0) + d.products,
    applied: Number(row?.applied ?? 0) + d.applied,
    suggested: Number(row?.suggested ?? 0) + d.suggested,
    failed: Number(row?.failed ?? 0) + d.failed,
    input_tokens: Number(row?.input_tokens ?? 0) + d.usage.input,
    cached_tokens: Number(row?.cached_tokens ?? 0) + d.usage.cached,
    output_tokens: Number(row?.output_tokens ?? 0) + d.usage.output,
    cost_usd: Number(row?.cost_usd ?? 0) + d.usage.costUsd,
    updated_at: now,
  };
  const { error } = row
    ? await client.from("catalogue_check_runs").update(sums).eq("id", runId)
    : await client.from("catalogue_check_runs").insert({ id: runId, trigger, model, admin_id: adminId, started_at: now, ...sums });
  if (error) console.error(`[catalogue-check] could not record run ${runId}: ${error.message}`);
}

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Spent this calendar month (UTC): by the background sweep, and in total. */
async function monthSpend(): Promise<{ auto: number; total: number }> {
  const { data, error } = await db().from("catalogue_check_runs").select("trigger, cost_usd").gte("started_at", monthStart());
  if (error) return { auto: 0, total: 0 };
  let auto = 0;
  let total = 0;
  for (const r of (data ?? []) as { trigger: string; cost_usd: number | string }[]) {
    const cost = Number(r.cost_usd) || 0;
    total += cost;
    if (r.trigger === "auto") auto += cost;
  }
  return { auto, total };
}

// ── Checking records ─────────────────────────────────────────────────────────

/** Records per model call: enough to spread the shared block, few enough to stay accurate. */
const PER_CALL = 10;
/** Calls in flight at once. */
const PARALLEL_CALLS = 2;

export interface ProductLine {
  id: string;
  name: string;
  applied: string[];
  suggested: string[];
  /** The model left this record out of its answer; it stays unchecked. */
  failed?: boolean;
}

export interface BatchOutcome {
  checked: number;
  applied: number;
  suggested: number;
  failed: number;
  usage: Usage;
  lines: ProductLine[];
  /** Set when the model could not be reached at all. */
  error?: string;
}

interface PriorFix {
  id: number;
  product_id: string;
  field: string;
  after: Record<string, unknown>;
  status: string;
}

/** Keys sorted: jsonb hands an object back in its own key order, not the one it was written in. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const afterKey = (productId: string, field: string, after: unknown) => `${productId}\u0000${field}\u0000${stableJson(after ?? {})}`;

/** Earlier verdicts on these products that a new fix must respect. */
async function priorFixes(ids: string[]): Promise<PriorFix[]> {
  if (!ids.length) return [];
  const { data, error } = await db()
    .from("catalogue_check_fixes")
    .select("id, product_id, field, after, status")
    .in("product_id", ids)
    .in("status", ["undone", "dismissed", "suggested"]);
  if (error) {
    if (isMissingTable(error)) throw new NotMigrated();
    throw new Error(error.message);
  }
  return (data ?? []) as PriorFix[];
}

async function inPool<T>(items: T[], lanes: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(lanes, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
}

/**
 * Check a set of records: ask the model, judge its answer, write what may be
 * written, journal everything, and stamp each record as checked.
 */
async function checkRows(
  rows: CheckRow[],
  opts: { runId: string; trigger: RunTrigger; settings: CheckSettings; adminId: string | null; apiKey: string; ctx: Context },
): Promise<BatchOutcome> {
  const client = db();
  const outcome: BatchOutcome = { checked: 0, applied: 0, suggested: 0, failed: 0, usage: NO_USAGE, lines: [] };
  if (!rows.length) return outcome;

  const chunks: CheckRow[][] = [];
  for (let i = 0; i < rows.length; i += PER_CALL) chunks.push(rows.slice(i, i + PER_CALL));

  const answers = new Map<string, ModelFix[]>();
  const errors: string[] = [];
  await inPool(chunks, PARALLEL_CALLS, async (chunk) => {
    try {
      const res = await checkProductsWithModel(
        chunk.map((r) => productForModel(r, opts.ctx.colorGroups)),
        opts.ctx,
        opts.settings.model,
        opts.apiKey,
      );
      outcome.usage = addUsage(outcome.usage, res.usage);
      for (const [id, fixes] of res.fixes) answers.set(id, fixes);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  });

  const answered = rows.filter((r) => answers.has(r.id));
  const prior = await priorFixes(answered.map((r) => r.id));
  const refused = new Set(prior.filter((p) => p.status !== "suggested").map((p) => afterKey(p.product_id, p.field, p.after)));
  const open = new Map(prior.filter((p) => p.status === "suggested").map((p) => [afterKey(p.product_id, p.field, p.after), p]));
  const stillOpen = new Set<number>();
  const now = new Date().toISOString();

  await inPool(rows, 6, async (row) => {
    const line: ProductLine = { id: row.id, name: row.name, applied: [], suggested: [] };
    outcome.lines.push(line);
    const proposed = answers.get(row.id);
    if (!proposed) {
      line.failed = true;
      outcome.failed++;
      return;
    }

    const { fixes } = judgeFixes(row, proposed, opts.ctx);
    const toApply: ValidFix[] = [];
    const toSuggest: ValidFix[] = [];
    for (const fix of fixes) {
      const key = afterKey(row.id, fix.field, fix.after);
      // Undone or dismissed before: a person already said no to exactly this.
      if (refused.has(key)) continue;
      // Already waiting for a person: keep that one, do not add a twin.
      const waiting = open.get(key);
      if (waiting) {
        stillOpen.add(waiting.id);
        continue;
      }
      const writable = Object.keys(fix.after).length > 0;
      // "Suggest only" writes nothing; "off" only stops the background sweep.
      if (writable && opts.settings.mode !== "suggest" && fix.confidence === "high") toApply.push(fix);
      else toSuggest.push(fix);
    }

    const journal = [...toApply.map((f) => ({ f, status: "applied" })), ...toSuggest.map((f) => ({ f, status: "suggested" }))];
    let journalIds: number[] = [];
    if (journal.length) {
      const { data, error } = await client
        .from("catalogue_check_fixes")
        .insert(
          journal.map(({ f, status }) => ({
            run_id: opts.runId,
            product_id: row.id,
            field: f.field,
            before: f.before,
            after: f.after,
            reason: f.reason,
            confidence: f.confidence,
            status,
            source: "product",
            model: opts.settings.model,
            decided_at: status === "applied" ? now : null,
          })),
        )
        .select("id");
      if (error) {
        if (isMissingTable(error)) throw new NotMigrated();
        line.failed = true;
        outcome.failed++;
        return;
      }
      journalIds = ((data ?? []) as { id: number }[]).map((d) => d.id);
    }

    const patch = Object.assign({}, ...toApply.map((f) => f.after)) as Record<string, unknown>;
    const { error } = await client
      .from("products")
      .update({ ...patch, catalogue_fingerprint: fingerprint(rowAfter(row, toApply)), catalogue_checked_at: now })
      .eq("id", row.id);
    if (error) {
      // Nothing was written, so nothing is left claiming it was.
      if (journalIds.length) await client.from("catalogue_check_fixes").delete().in("id", journalIds);
      if (/catalogue_fingerprint|catalogue_checked_at/.test(error.message)) throw new NotMigrated();
      line.failed = true;
      outcome.failed++;
      return;
    }

    outcome.checked++;
    outcome.applied += toApply.length;
    outcome.suggested += toSuggest.length;
    line.applied = toApply.map((f) => f.field);
    line.suggested = toSuggest.map((f) => f.field);
  });

  // Suggestions on these records that this check did not make again are out of date.
  const superseded = prior
    .filter((p) => p.status === "suggested" && !stillOpen.has(p.id) && answers.has(p.product_id))
    .map((p) => p.id);
  if (superseded.length) {
    await client.from("catalogue_check_fixes").update({ status: "stale", decided_at: now }).in("id", superseded);
  }

  await addToRun(opts.runId, opts.trigger, opts.settings.model, opts.adminId, {
    products: outcome.checked,
    applied: outcome.applied,
    suggested: outcome.suggested,
    failed: outcome.failed,
    usage: outcome.usage,
  });
  if (outcome.applied) revalidateCatalogue();
  if (errors.length && !answered.length) outcome.error = `The model could not be reached: ${errors[0]}`;
  return outcome;
}

function revalidateCatalogue(): void {
  void import("next/cache")
    .then(({ revalidatePath }) => {
      for (const path of ["/", "/browse", "/builder", "/goo-studio/products"]) revalidatePath(path);
    })
    .catch(() => {
      /* outside a request — the pages refresh on their own schedule */
    });
}

// ── A run from the studio ────────────────────────────────────────────────────

/** Records per request from the studio's tab: two model calls' worth. */
const STEP_SIZE = 20;
/** Records scanned per request when looking for ones that changed. */
const SCAN_SIZE = 500;

export type StepScope = "unchecked" | "changed" | "all";

export interface StepResult extends BatchOutcome {
  runId: string;
  /** Pass back for the next step; null when the catalogue has been walked. */
  cursor: string | null;
  scanned: number;
}

/**
 * One step of a run driven from the studio. The catalogue is walked in id
 * order, so every record is looked at once per run however its check went.
 */
export async function runStep(opts: {
  scope: StepScope;
  cursor: string | null;
  runId: string | null;
  adminId: string;
}): Promise<StepResult> {
  const client = db();
  const settings = await getCheckSettings();
  const apiKey = await getOpenAIKey();
  if (!apiKey) throw new Error("No OpenAI key — add one under Settings or set OPENAI_API_KEY.");
  const runId = opts.runId || newRunId("manual");
  const ctx = await loadContext(settings.notes, !opts.runId);

  let rows: CheckRow[];
  let cursor: string | null;
  let scanned: number;
  if (opts.scope === "unchecked") {
    rows = await selectRows((cols) => {
      let q = client.from("products").select(cols).is("catalogue_fingerprint", null).order("id").limit(STEP_SIZE);
      if (opts.cursor) q = q.gt("id", opts.cursor);
      return q;
    });
    scanned = rows.length;
    cursor = rows.length === STEP_SIZE ? rows[rows.length - 1].id : null;
  } else {
    const page = await selectRows((cols) => {
      let q = client.from("products").select(cols).order("id").limit(SCAN_SIZE);
      if (opts.cursor) q = q.gt("id", opts.cursor);
      return q;
    });
    const due = opts.scope === "all" ? page : page.filter(needsCheck);
    rows = due.slice(0, STEP_SIZE);
    // Stop the cursor at the last record taken, so the next step resumes right after it.
    const last = rows.length === STEP_SIZE ? rows[rows.length - 1] : page[page.length - 1];
    scanned = last ? page.indexOf(last) + 1 : 0;
    cursor = page.length === SCAN_SIZE || rows.length === STEP_SIZE ? last?.id ?? null : null;
  }

  const outcome = await checkRows(rows, { runId, trigger: "manual", settings, adminId: opts.adminId, apiKey, ctx });
  return { ...outcome, runId, cursor: outcome.error ? opts.cursor : cursor, scanned };
}

// ── Brands ───────────────────────────────────────────────────────────────────

/** Brand values per model call. */
const BRANDS_PER_CALL = 300;

function hostOf(url: string | null | undefined): string {
  try {
    return url ? new URL(url).host.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

/** Every brand value in the catalogue with its count, stores and an example, in a stable order. */
async function loadBrandEntries(): Promise<(BrandEntry & { key: string })[]> {
  const client = db();
  const byValue = new Map<string, { products: number; stores: Map<string, number>; example: string }>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("products")
      .select("brand, name, source_url")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { brand: string | null; name: string | null; source_url: string | null }[];
    for (const r of rows) {
      const value = r.brand ?? "";
      if (!value.trim()) continue;
      const entry = byValue.get(value) ?? { products: 0, stores: new Map(), example: r.name ?? "" };
      entry.products++;
      const host = hostOf(r.source_url);
      if (host) entry.stores.set(host, (entry.stores.get(host) ?? 0) + 1);
      byValue.set(value, entry);
    }
    if (rows.length < PAGE) break;
  }
  return [...byValue.entries()]
    .map(([value, e]) => ({
      value,
      key: `${brandWords(value) || foldBrand(value)}\u0000${value}`,
      products: e.products,
      stores: [...e.stores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h),
      example: e.example.slice(0, 80),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export interface BrandStepResult {
  runId: string;
  cursor: string | null;
  reviewed: number;
  merges: { from: string; to: string; products: number; applied: boolean; reason: string }[];
  notBrands: { value: string; products: number; reason: string }[];
  usage: Usage;
}

/**
 * One step of the brand review: a slice of the catalogue's brand values,
 * sorted so that spellings of one brand sit next to each other, to the model.
 *
 * A merge that only changes case, accents or punctuation is written when the
 * model is sure (unless the mode is "suggest"); anything that changes the words ("Carhartt" →
 * "Carhartt WIP") waits for a person, whatever the model says. A value that is
 * not a brand at all is not guessed at here: its products are sent back to the
 * record check, which can read each one's own name and page address.
 */
export async function runBrandStep(opts: { cursor: string | null; runId: string | null; adminId: string }): Promise<BrandStepResult> {
  const client = db();
  const settings = await getCheckSettings();
  const apiKey = await getOpenAIKey();
  if (!apiKey) throw new Error("No OpenAI key — add one under Settings or set OPENAI_API_KEY.");
  const runId = opts.runId || newRunId("brands");

  const all = await loadBrandEntries();
  const slice = all.filter((e) => !opts.cursor || e.key > opts.cursor).slice(0, BRANDS_PER_CALL);
  const result: BrandStepResult = { runId, cursor: null, reviewed: slice.length, merges: [], notBrands: [], usage: NO_USAGE };
  if (!slice.length) return result;

  const answer = await reviewBrandsWithModel(slice, settings.notes, settings.model, apiKey);
  result.usage = answer.usage;
  const values = new Map(all.map((e) => [e.value, e]));
  let applied = 0;
  let suggested = 0;

  for (const m of answer.merges) {
    const from = String(m.from ?? "");
    const to = String(m.to ?? "").replace(/\s+/g, " ").trim();
    if (m.confidence === "low" || !values.has(from) || !to || to === from || isNotABrand(to)) continue;
    // "to" is a spelling the catalogue has, or "from" re-cased — never a new name.
    if (!values.has(to) && foldBrand(to) !== foldBrand(from)) continue;
    const sameWords = brandWords(from).replace(/ /g, "") === brandWords(to).replace(/ /g, "");
    const write = sameWords && m.confidence === "high" && settings.mode !== "suggest";
    const n = await mergeBrand(from, to, { runId, write, reason: m.reason, model: settings.model });
    if (!n) continue;
    if (write) applied += n;
    else suggested += n;
    result.merges.push({ from, to, products: n, applied: write, reason: m.reason });
  }

  for (const nb of answer.notBrands) {
    const value = String(nb.value ?? "");
    if (!values.has(value)) continue;
    // Back to the record check, which reads each product's own evidence.
    const { data } = await client.from("products").update({ catalogue_fingerprint: null }).eq("brand", value).select("id");
    result.notBrands.push({ value, products: (data ?? []).length, reason: nb.reason });
  }

  await addToRun(runId, "brands", settings.model, opts.adminId, {
    products: slice.reduce((n, e) => n + e.products, 0),
    applied,
    suggested,
    failed: 0,
    usage: result.usage,
  });
  if (applied) revalidateCatalogue();
  result.cursor = slice.length === BRANDS_PER_CALL ? slice[slice.length - 1].key : null;
  return result;
}

/** Re-brand every product carrying `from`, or propose it; returns how many products. */
async function mergeBrand(
  from: string,
  to: string,
  opts: { runId: string; write: boolean; reason: string; model: string },
): Promise<number> {
  const client = db();
  const rows: CheckRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await selectRows((cols) =>
      client.from("products").select(cols).eq("brand", from).order("id").range(offset, offset + PAGE - 1),
    );
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (!rows.length) return 0;

  // Said no to before, or already waiting for a person.
  const skip = new Set<string>();
  for (const ids of chunked(rows.map((r) => r.id))) {
    const { data } = await client
      .from("catalogue_check_fixes")
      .select("product_id, after")
      .in("product_id", ids)
      .eq("field", "brand")
      .in("status", ["undone", "dismissed", "suggested"]);
    for (const p of (data ?? []) as { product_id: string; after: { brand?: string } }[]) {
      if (p.after?.brand === to) skip.add(p.product_id);
    }
  }
  const todo = rows.filter((r) => !skip.has(r.id));
  if (!todo.length) return 0;

  const now = new Date().toISOString();
  let done = 0;
  await inPool(todo, 8, async (row) => {
    const { data, error } = await client
      .from("catalogue_check_fixes")
      .insert({
        run_id: opts.runId,
        product_id: row.id,
        field: "brand",
        before: { brand: from },
        after: { brand: to },
        reason: opts.reason.slice(0, 400),
        confidence: opts.write ? "high" : "medium",
        status: opts.write ? "applied" : "suggested",
        source: "brand",
        model: opts.model,
        decided_at: opts.write ? now : null,
      })
      .select("id")
      .single();
    if (error) {
      if (isMissingTable(error)) throw new NotMigrated();
      return;
    }
    if (opts.write) {
      // A record that was clean before stays clean: only the brand moved.
      const clean = row.catalogue_fingerprint === fingerprint(row);
      const next = rowAfter(row, [{ after: { brand: to } }]);
      const { error: writeError } = await client
        .from("products")
        .update({ brand: to, ...(clean ? { catalogue_fingerprint: fingerprint(next) } : {}) })
        .eq("id", row.id)
        .eq("brand", from);
      if (writeError) {
        await client.from("catalogue_check_fixes").delete().eq("id", (data as { id: number }).id);
        return;
      }
    }
    done++;
  });

  if (opts.write && done) {
    await client.from("brands").upsert({ name: to }, { onConflict: "name", ignoreDuplicates: true });
  }
  return done;
}

// ── A person's decisions ─────────────────────────────────────────────────────

interface FixRow {
  id: number;
  run_id: string;
  product_id: string;
  field: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  status: string;
}

export interface DecisionResult {
  done: number;
  /** The product changed since, so the fix no longer applies. */
  stale: number;
  errors: string[];
}

/**
 * Apply a waiting suggestion, dismiss it, or undo an applied fix.
 *
 * Applying checks that the columns still hold what they held when the check
 * looked, and undoing that they still hold what the fix wrote — so neither
 * ever overwrites an edit made in between. An undone or dismissed fix is
 * remembered: the check will not propose it again for that product.
 */
export async function decideFixes(ids: number[], action: "apply" | "dismiss" | "undo", adminId: string): Promise<DecisionResult> {
  const client = db();
  const result: DecisionResult = { done: 0, stale: 0, errors: [] };
  if (!ids.length) return result;
  const fixes: FixRow[] = [];
  for (const part of chunked(ids)) {
    const { data, error } = await client
      .from("catalogue_check_fixes")
      .select("id, run_id, product_id, field, before, after, status")
      .in("id", part);
    if (error) throw new Error(isMissingTable(error) ? new NotMigrated().message : error.message);
    fixes.push(...((data ?? []) as FixRow[]));
  }
  // Undo walks back newest first, so two fixes on one column unwind in order.
  fixes.sort((a, b) => (action === "undo" ? b.id - a.id : a.id - b.id));
  const now = new Date().toISOString();
  const mark = (id: number, status: string) =>
    client.from("catalogue_check_fixes").update({ status, decided_by: adminId, decided_at: now }).eq("id", id);

  for (const fix of fixes) {
    if (action === "dismiss") {
      if (fix.status !== "suggested") continue;
      await mark(fix.id, "dismissed");
      result.done++;
      continue;
    }

    const wanted = action === "apply" ? "suggested" : "applied";
    if (fix.status !== wanted) continue;
    if (action === "apply" && !Object.keys(fix.after ?? {}).length) {
      result.errors.push("A price is never changed by the check — edit it in the product.");
      continue;
    }
    const [row] = await selectRows((cols) => client.from("products").select(cols).eq("id", fix.product_id).limit(1));
    if (!row) {
      await mark(fix.id, "stale");
      result.stale++;
      continue;
    }
    const expect = action === "apply" ? fix.before : fix.after;
    const write = action === "apply" ? fix.after : fix.before;
    if (!rowHolds(row as unknown as Record<string, unknown>, expect)) {
      if (action === "apply") await mark(fix.id, "stale");
      result.stale++;
      continue;
    }
    const next = rowAfter(row, [{ after: write }]);
    // The record as a person left it counts as checked; it is not sent to the model again for this.
    const { error: writeError } = await client
      .from("products")
      .update({ ...write, catalogue_fingerprint: fingerprint(next), catalogue_checked_at: now })
      .eq("id", fix.product_id);
    if (writeError) {
      result.errors.push(writeError.message);
      continue;
    }
    await mark(fix.id, action === "apply" ? "applied" : "undone");
    result.done++;
  }
  if (result.done && action !== "dismiss") revalidateCatalogue();
  return result;
}

/** Undo every fix a run applied, newest first. */
export async function undoRun(runId: string, adminId: string): Promise<DecisionResult> {
  const { data, error } = await db()
    .from("catalogue_check_fixes")
    .select("id")
    .eq("run_id", runId)
    .eq("status", "applied")
    .limit(5_000);
  if (error) throw new Error(error.message);
  return decideFixes(((data ?? []) as { id: number }[]).map((d) => d.id), "undo", adminId);
}

/**
 * A product saved by hand in the editor: a record that had been checked counts
 * as checked again as the person left it, so the check does not argue with an
 * edit. A record never checked is left for the check.
 */
export async function markReviewed(productId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const [row] = await selectRows((cols) => supabase!.from("products").select(cols).eq("id", productId).limit(1));
    if (!row?.catalogue_fingerprint) return;
    await supabase
      .from("products")
      .update({ catalogue_fingerprint: fingerprint(row), catalogue_checked_at: new Date().toISOString() })
      .eq("id", productId);
  } catch {
    /* migration not run, or the read failed — the check simply looks at it again */
  }
}

// ── The background sweep ─────────────────────────────────────────────────────

/** Records per sweep step, and steps per wake-up (so one import never starts an hour of work). */
const SWEEP_BATCH = 20;
const SWEEP_STEPS = 15;
const SWEEP_EVERY_MS = 15_000;
/** A record the model left out is tried again after this. */
const RETRY_AFTER_MS = 30 * 60_000;

const queued = new Set<string>();
const retryAt = new Map<string, number>();
let sweeping: Promise<void> | null = null;
let lastSweepAt = 0;
let pausedUntil = 0;
let followUp: ReturnType<typeof setTimeout> | null = null;

/**
 * Check imported products in the background. Called after every import with
 * the products it touched; also picks up products never checked, newest
 * first, so the back catalogue is worked through over time.
 *
 * At most one sweep runs at a time and it never spends past the monthly cap
 * set in the studio. Nothing happens when the mode is "off", there is no
 * OpenAI key, or migration 025 has not run.
 */
export function checkPendingProducts(opts: { ids?: (string | null | undefined)[] } = {}): Promise<void> {
  for (const id of opts.ids ?? []) if (id) queued.add(id);
  if (sweeping) return sweeping;
  const now = Date.now();
  if (now < pausedUntil || now - lastSweepAt < SWEEP_EVERY_MS) {
    // Ids that arrive while throttled are not left waiting for the next import.
    if (queued.size && !followUp) {
      followUp = setTimeout(() => {
        followUp = null;
        void checkPendingProducts();
      }, Math.max(SWEEP_EVERY_MS, pausedUntil - now));
    }
    return Promise.resolve();
  }
  lastSweepAt = now;
  sweeping = sweep().finally(() => {
    sweeping = null;
    lastSweepAt = Date.now();
  });
  return sweeping;
}

async function sweep(): Promise<void> {
  try {
    if (!isSupabaseConfigured || !supabase) return;
    const settings = await getCheckSettings();
    if (settings.mode === "off") return;
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      pausedUntil = Date.now() + 10 * 60_000;
      return;
    }
    const client = supabase;
    const ctx = await loadContext(settings.notes);

    for (let step = 0; step < SWEEP_STEPS; step++) {
      const spent = await monthSpend();
      if (spent.auto >= settings.monthlyBudgetUsd) {
        pausedUntil = Date.now() + 60 * 60_000;
        queued.clear();
        return;
      }

      const now = Date.now();
      for (const [id, at] of retryAt) if (at <= now) retryAt.delete(id);
      const ids = [...queued].slice(0, SWEEP_BATCH);
      for (const id of ids) queued.delete(id);
      let rows = ids.length
        ? (await selectRows((cols) => client.from("products").select(cols).in("id", ids))).filter(needsCheck)
        : [];
      if (rows.length < SWEEP_BATCH) {
        const fill = await selectRows((cols) =>
          client
            .from("products")
            .select(cols)
            .is("catalogue_fingerprint", null)
            .order("created_at", { ascending: false })
            .limit(SWEEP_BATCH * 2),
        );
        const have = new Set(rows.map((r) => r.id));
        rows = [...rows, ...fill.filter((r) => !have.has(r.id) && !retryAt.has(r.id))].slice(0, SWEEP_BATCH);
      }
      if (!rows.length) return;

      const outcome = await checkRows(rows, { runId: autoRunId(), trigger: "auto", settings, adminId: null, apiKey, ctx });
      for (const line of outcome.lines) if (line.failed) retryAt.set(line.id, Date.now() + RETRY_AFTER_MS);
      if (outcome.error) {
        pausedUntil = Date.now() + 5 * 60_000;
        return;
      }
    }
  } catch (err) {
    if (err instanceof NotMigrated) pausedUntil = Date.now() + 60 * 60_000;
    else console.error("[catalogue-check] sweep failed:", err instanceof Error ? err.message : err);
  } finally {
    if (queued.size && !followUp) {
      followUp = setTimeout(() => {
        followUp = null;
        void checkPendingProducts();
      }, SWEEP_EVERY_MS);
    }
  }
}

// ── What the studio shows ────────────────────────────────────────────────────

/** A fix's columns as one line a person can read: "Nike", "Sneakers · footwear", "Black, White · filters Black, White". */
function describe(patch: Record<string, unknown>, groupName: Map<number, string>): string {
  const parts: string[] = [];
  for (const [column, value] of Object.entries(patch)) {
    // Derived from a neighbour: the swatch from the colour, the currency beside the price.
    if (column === "color_hex" || column === "currency") continue;
    let text: string;
    if (column === "color_group_ids") {
      const names = ((value as number[] | null) ?? []).map((id) => groupName.get(id) ?? `#${id}`);
      text = `filters ${names.join(", ") || "none"}`;
    } else if (Array.isArray(value)) text = value.join(", ") || "(none)";
    else if (value === null || value === undefined || value === "") text = "(none)";
    else text = String(value);
    if (column === "price_min") text = `${text} ${String(patch.currency ?? "")}`.trim();
    parts.push(text.length > 160 ? `${text.slice(0, 160)}… (${text.length} chars)` : text);
  }
  return parts.join(" · ");
}

export interface FixView {
  id: number;
  runId: string;
  productId: string;
  productName: string;
  brand: string;
  field: string;
  /** The columns before and after, as a person reads them. */
  beforeText: string;
  afterText: string;
  /** False for a price flag: there is nothing to write. */
  writable: boolean;
  reason: string;
  confidence: string;
  status: string;
  source: string;
  createdAt: string;
}

export interface RunView {
  id: string;
  trigger: string;
  model: string;
  products: number;
  applied: number;
  suggested: number;
  failed: number;
  costUsd: number;
  startedAt: string;
}

export interface CheckStatus {
  migrated: boolean;
  keyConfigured: boolean;
  settings: CheckSettings;
  models: { id: string; label: string }[];
  counts: { products: number; unchecked: number; suggestions: number };
  spend: { autoThisMonth: number; totalThisMonth: number };
  estimate: { uncheckedUsd: number; allUsd: number };
  sweepPausedUntil: string | null;
  suggestions: FixView[];
  applied: FixView[];
  runs: RunView[];
}

const LIST_LIMIT = 300;

function toFixView(r: Record<string, unknown>, groupName: Map<number, string>): FixView {
  const p = (r.products ?? {}) as { name?: string; brand?: string };
  const before = (r.before ?? {}) as Record<string, unknown>;
  const after = (r.after ?? {}) as Record<string, unknown>;
  return {
    id: Number(r.id),
    runId: String(r.run_id ?? ""),
    productId: String(r.product_id ?? ""),
    productName: p.name ?? "",
    brand: p.brand ?? "",
    field: String(r.field ?? ""),
    beforeText: describe(before, groupName),
    afterText: describe(after, groupName),
    writable: Object.keys(after).length > 0,
    reason: String(r.reason ?? ""),
    confidence: String(r.confidence ?? ""),
    status: String(r.status ?? ""),
    source: String(r.source ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

export async function checkStatus(): Promise<CheckStatus> {
  const client = db();
  const [settings, key] = await Promise.all([getCheckSettings(), getOpenAIKey()]);
  const models = Object.entries(CHECK_MODELS).map(([id, m]) => ({ id, label: m.label }));

  const total = await client.from("products").select("id", { count: "exact", head: true });
  const products = total.count ?? 0;
  const unchecked = await client.from("products").select("id", { count: "exact", head: true }).is("catalogue_fingerprint", null);
  const fixesProbe = await client.from("catalogue_check_fixes").select("id", { count: "exact", head: true }).eq("status", "suggested");
  const migrated = !unchecked.error && !fixesProbe.error;

  const base: CheckStatus = {
    migrated,
    keyConfigured: !!key,
    settings,
    models,
    counts: { products, unchecked: migrated ? unchecked.count ?? 0 : products, suggestions: fixesProbe.count ?? 0 },
    spend: { autoThisMonth: 0, totalThisMonth: 0 },
    estimate: {
      uncheckedUsd: estimateCostUsd(migrated ? unchecked.count ?? 0 : products, settings.model),
      allUsd: estimateCostUsd(products, settings.model),
    },
    sweepPausedUntil: pausedUntil > Date.now() ? new Date(pausedUntil).toISOString() : null,
    suggestions: [],
    applied: [],
    runs: [],
  };
  if (!migrated) return base;

  const columns = "id, run_id, product_id, field, before, after, reason, confidence, status, source, created_at, products(name, brand)";
  const [suggestions, applied, runs, spend, groups] = await Promise.all([
    client.from("catalogue_check_fixes").select(columns).eq("status", "suggested").order("id", { ascending: false }).limit(LIST_LIMIT),
    client.from("catalogue_check_fixes").select(columns).eq("status", "applied").order("id", { ascending: false }).limit(LIST_LIMIT),
    client.from("catalogue_check_runs").select("*").order("started_at", { ascending: false }).limit(20),
    monthSpend(),
    getAllColorGroups(),
  ]);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  base.suggestions = ((suggestions.data ?? []) as Record<string, unknown>[]).map((r) => toFixView(r, groupName));
  base.applied = ((applied.data ?? []) as Record<string, unknown>[]).map((r) => toFixView(r, groupName));
  base.runs = ((runs.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    trigger: String(r.trigger ?? ""),
    model: String(r.model ?? ""),
    products: Number(r.products ?? 0),
    applied: Number(r.applied ?? 0),
    suggested: Number(r.suggested ?? 0),
    failed: Number(r.failed ?? 0),
    costUsd: Number(r.cost_usd ?? 0),
    startedAt: String(r.started_at ?? ""),
  }));
  base.spend = { autoThisMonth: spend.auto, totalThisMonth: spend.total };
  return base;
}

export { NotMigrated };
