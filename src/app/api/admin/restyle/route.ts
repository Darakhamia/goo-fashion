/**
 * Resets every style tag in the catalogue to the five basic styles.
 *
 * On 2026-09-29 the style vocabulary was cut from thirteen styles to five —
 * casual, minimal, classic, streetwear, sporty — and the tags already on the
 * catalogue were to go with it, the ones still in the vocabulary included, so
 * that products carry only basic styles given afresh. This is that job:
 *
 *   - every product's tags are replaced by the importer's rule
 *     (`proposeStyles`): what the style dictionary reads in its own name,
 *     description, material and subcategory leads, and the style its brand
 *     stands for fills in — beside a single style from the words, or alone
 *     when the words name none. Only the built-in brand list speaks for the
 *     brand here, not the catalogue's habits: those are learned from the very
 *     tags this run replaces. A product with neither is left with no style
 *     rather than a guess: the editor fills it in, one by one or with Edit N;
 *   - every curated look (`outfits`) loses its tags. A look's style is the
 *     editor's call, and the old one was made in a vocabulary that no longer
 *     exists.
 *
 * Shoppers' own looks (`user_looks`, `pending_looks`) are not written: their
 * tags are the shopper's choice, and every reader already drops the styles
 * that went (`normalizeStyleKeywords`).
 *
 * GET (or POST without `apply`) is a dry run that writes nothing. An applied
 * run records every value it replaced, so the last run can be undone once.
 *
 *   GET  /api/admin/restyle                → dry run
 *   POST /api/admin/restyle {apply:true}   → apply
 *   POST /api/admin/restyle {undo:true}    → revert the last applied run (once)
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { STYLE_KEYWORD_LIST } from "@/lib/style-keywords";
import { inferStyleKeywords } from "@/lib/taxonomy/styles";
import { buildCatalogueProfile, proposeStyles } from "@/lib/server/catalogue-profile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Table = "products" | "outfits";
type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  material: string | null;
  subcategory: string | null;
  style_keywords: string[] | null;
};
type OutfitRow = { id: string; style_keywords: string[] | null };
/** One row's tags before and after a run. */
type Change = { table: Table; id: string; from: string[]; to: string[] };

const PAGE = 1000;
/** Ids per `.in()` filter, so a write's query string stays well under URL limits. */
const CHUNK = 200;

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

/** The same tags, whatever order they were stored in. */
const tagsKey = (tags: string[]) => [...tags].sort().join(",");
const sameTags = (a: string[], b: string[]) => tagsKey(a) === tagsKey(b);

async function fetchAll<T>(table: Table, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** Every page can show a style — cards, product and look pages, their titles. */
function refreshPages() {
  try { revalidatePath("/", "layout"); } catch { /* best-effort */ }
}

/** Records an applied run so it can be reversed. Undo is only offered if this works. */
async function recordRun(adminId: string, changes: Change[]): Promise<boolean> {
  const { error } = await supabase!.from("admin_audit_log").insert({
    admin_id: adminId,
    action: "products.styles_reset",
    target_type: "products",
    metadata: {
      products: changes.filter((c) => c.table === "products").length,
      outfits: changes.filter((c) => c.table === "outfits").length,
      changes,
    },
  });
  return !error;
}

async function run(apply: boolean, adminId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  let products: ProductRow[];
  let outfits: OutfitRow[];
  try {
    [products, outfits] = await Promise.all([
      fetchAll<ProductRow>("products", "id, name, brand, description, material, subcategory, style_keywords"),
      fetchAll<OutfitRow>("outfits", "id, style_keywords"),
    ]);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read the catalogue" }, { status: 500 });
  }

  const changes: Change[] = [];
  // What the catalogue looks like after the run: products per basic style, and
  // those left with none. Counted over every product, changed or not.
  const after: Record<string, number> = Object.fromEntries(STYLE_KEYWORD_LIST.map((s) => [s, 0]));
  let unstyled = 0;
  // Old tags taken off, per tag — the dropped styles and the basic ones alike.
  const removed: Record<string, number> = {};

  // No catalogue habits: an empty profile leaves the words and the brand list.
  const noHabits = buildCatalogueProfile([]);
  for (const p of products) {
    const from = p.style_keywords ?? [];
    const to = proposeStyles(
      {
        brand: p.brand ?? "",
        keywordStyles: inferStyleKeywords([p.name, p.description ?? "", p.material ?? "", p.subcategory ?? ""].join(" ")),
      },
      noHabits,
    ).styles;
    if (to.length) for (const s of to) after[s]++;
    else unstyled++;
    if (sameTags(from, to)) continue;
    const kept = new Set<string>(to);
    for (const s of from) if (!kept.has(s)) removed[s] = (removed[s] ?? 0) + 1;
    changes.push({ table: "products", id: p.id, from, to });
  }
  for (const o of outfits) {
    const from = o.style_keywords ?? [];
    if (from.length) changes.push({ table: "outfits", id: o.id, from, to: [] });
  }

  const productChanges = changes.filter((c) => c.table === "products");
  const outfitChanges = changes.filter((c) => c.table === "outfits");

  let applied = 0;
  let undoable = false;
  const failures: { table: Table; id: string; error: string }[] = [];
  if (apply && changes.length) {
    // One write per table and resulting tag set rather than one per row: five
    // styles make at most a few dozen distinct sets over the whole catalogue.
    const groups = new Map<string, Change[]>();
    for (const c of changes) {
      const key = `${c.table}\u0000${tagsKey(c.to)}`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    const written: Change[] = [];
    for (const list of groups.values()) {
      const { table, to } = list[0];
      for (const chunk of chunks(list)) {
        const { error } = await supabase.from(table).update({ style_keywords: to }).in("id", chunk.map((c) => c.id));
        if (error) failures.push(...chunk.map((c) => ({ table, id: c.id, error: error.message })));
        else written.push(...chunk);
      }
    }
    applied = written.length;
    if (applied > 0) {
      undoable = await recordRun(adminId, written);
      refreshPages();
    }
  }

  return NextResponse.json({
    mode: apply ? "apply" : "dry-run",
    scanned: { products: products.length, outfits: outfits.length },
    wouldChange: { products: productChanges.length, outfits: outfitChanges.length },
    after: { ...after, none: unstyled },
    removed,
    applied: apply ? applied : 0,
    // False after an apply means the run was not recorded and cannot be
    // reverted from here — worth saying out loud rather than discovering later.
    undoable: apply ? undoable : null,
    failures,
    // A capped sample so the response stays readable on large catalogues.
    sample: productChanges.slice(0, 100).map((c) => ({
      id: c.id,
      name: products.find((p) => p.id === c.id)?.name ?? "",
      from: c.from,
      to: c.to,
    })),
  });
}

/**
 * Puts back what the last applied run changed.
 *
 * A row is only restored when it still holds the tags that run wrote. Anything
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
    .eq("action", "products.styles_reset")
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
    return NextResponse.json({ error: "No style reset to undo." }, { status: 404 });
  }

  // Undo reverses the last run once. A second press would restore nothing and
  // still write a journal entry saying it had.
  const undone = await supabase
    .from("admin_audit_log")
    .select("id")
    .eq("action", "products.styles_reset_undone")
    .gt("created_at", entry.created_at)
    .limit(1);
  if (undone.error) {
    return NextResponse.json(
      { error: `Could not check whether the last run was already undone: ${undone.error.message}` },
      { status: 503 },
    );
  }
  if ((undone.data ?? []).length) {
    return NextResponse.json({ error: "The last style reset has already been undone." }, { status: 409 });
  }

  let restored = 0;
  let changedSince = 0;
  const failures: { table: Table; id: string; error: string }[] = [];

  for (const table of ["products", "outfits"] as const) {
    const mine = changes.filter((c) => c.table === table);
    if (!mine.length) continue;

    // Current tags in one read per chunk rather than one per row.
    const current = new Map<string, string[]>();
    const unread = new Set<string>();
    for (const ids of chunks(mine.map((c) => c.id))) {
      const { data: rows, error: readError } = await supabase.from(table).select("id, style_keywords").in("id", ids);
      if (readError) {
        for (const id of ids) {
          unread.add(id);
          failures.push({ table, id, error: readError.message });
        }
        continue;
      }
      for (const r of (rows ?? []) as OutfitRow[]) current.set(String(r.id), r.style_keywords ?? []);
    }

    // Grouped by what to put back over what the run wrote, and each write
    // matches only rows still holding exactly the run's tags, so an edit
    // landing between the read and the write is left alone.
    const byMove = new Map<string, { from: string[]; to: string[]; ids: string[] }>();
    for (const c of mine) {
      if (unread.has(c.id) || !current.has(c.id)) continue;
      if (!sameTags(current.get(c.id)!, c.to)) { changedSince++; continue; }
      const key = `${tagsKey(c.from)}\u0000${tagsKey(c.to)}`;
      const move = byMove.get(key) ?? { from: c.from, to: c.to, ids: [] };
      move.ids.push(c.id);
      byMove.set(key, move);
    }
    for (const { from, to, ids } of byMove.values()) {
      for (const chunk of chunks(ids)) {
        const { data: rows, error: writeError } = await supabase
          .from(table)
          .update({ style_keywords: from })
          .in("id", chunk)
          .contains("style_keywords", to)
          .containedBy("style_keywords", to)
          .select("id");
        if (writeError) {
          failures.push(...chunk.map((id) => ({ table, id, error: writeError.message })));
          continue;
        }
        const n = (rows ?? []).length;
        restored += n;
        changedSince += chunk.length - n;
      }
    }
  }

  // The run counts as undone only once every row was read and written. With
  // failures it stays open, so pressing Undo again retries them: rows already
  // restored no longer hold what the run wrote and are skipped.
  if (failures.length === 0) {
    await supabase.from("admin_audit_log").insert({
      admin_id: adminId,
      action: "products.styles_reset_undone",
      target_type: "products",
      metadata: { undid_run_at: entry.created_at, restored, changedSince },
    });
  }

  refreshPages();

  return NextResponse.json({ mode: "undo", ranAt: entry.created_at, restored, changedSince, failures });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run(false, admin.userId);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body?.undo === true) return undo(admin.userId);
  return run(body?.apply === true, admin.userId);
}
