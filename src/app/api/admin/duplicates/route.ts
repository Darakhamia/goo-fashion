/**
 * The same item held as two (or more) cards, and the merge that makes them one.
 *
 *   GET                             → the groups the finder proposes
 *   POST { action: "merge",   keepId, mergeIds }
 *                                   → one card with every store, the others gone
 *   POST { action: "dismiss", ids, against? }
 *                                   → "not the same item": never proposed again
 *
 * The finder is `lib/server/duplicates.ts` — the importer's own same-item test,
 * run over the whole catalogue. A merge moves everything that points at the
 * cards it removes onto the card it keeps first — shoppers' likes, the outfits
 * and the saved and submitted looks that use them — so no one's saved look
 * loses a piece, and only then deletes them.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isMissingTableLoose } from "@/lib/server/db-errors";
import { logAdminAction } from "@/lib/server/audit";
import { writeProductRow } from "@/lib/data/db";
import {
  findDuplicateGroups,
  mergeCardsPatch,
  pairKey,
  repointItems,
  type CatalogueRow,
} from "@/lib/server/duplicates";
import type { Retailer } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = 1000;

/** Richest first: the codes need migration 020. */
const COLUMN_SETS = [
  "id, brand, name, category, source_url, price_min, retailers, colors, images, image_url, created_at, gtin, mpn",
  "id, brand, name, category, source_url, price_min, retailers, colors, images, image_url, created_at",
];

/** Where "not the same item" is remembered: the label audit's dismissals (migration 012). */
const DISMISSALS = "label_audit_dismissals";
const DISMISS_FIELD = "duplicate";

type ProductRow = Record<string, unknown> & { id: string };

async function loadCatalogue(): Promise<ProductRow[] | { error: string }> {
  for (const columns of COLUMN_SETS) {
    const rows: ProductRow[] = [];
    let failed: string | null = null;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase!.from("products").select(columns).order("id").range(from, from + PAGE - 1);
      if (error) {
        failed = error.message;
        break;
      }
      const batch = (data ?? []) as unknown as ProductRow[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
    if (!failed) return rows;
    if (columns === COLUMN_SETS[COLUMN_SETS.length - 1]) return { error: failed };
  }
  return { error: "Could not read products" };
}

async function loadDismissed(): Promise<{ pairs: Set<string>; available: boolean }> {
  const { data, error } = await supabase!.from(DISMISSALS).select("product_id, stored").eq("field", DISMISS_FIELD);
  if (error) return { pairs: new Set(), available: !isMissingTableLoose(error) };
  return {
    pairs: new Set(((data ?? []) as { product_id: string; stored: string }[]).map((d) => pairKey(d.product_id, d.stored))),
    available: true,
  };
}

function toCatalogueRow(r: ProductRow): CatalogueRow {
  return {
    id: String(r.id),
    brand: String(r.brand ?? ""),
    name: String(r.name ?? ""),
    category: (r.category as string | null) ?? null,
    sourceUrl: (r.source_url as string | null) ?? null,
    priceMin: typeof r.price_min === "number" ? r.price_min : Number(r.price_min) || null,
    retailers: Array.isArray(r.retailers) ? (r.retailers as Retailer[]) : [],
    colors: Array.isArray(r.colors) ? (r.colors as string[]) : [],
    gtin: (r.gtin as string | null) ?? null,
    mpn: (r.mpn as string | null) ?? null,
    images: Array.isArray(r.images) ? (r.images as string[]) : [],
    createdAt: (r.created_at as string | null) ?? null,
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const [loaded, dismissed] = await Promise.all([loadCatalogue(), loadDismissed()]);
  if ("error" in loaded) return NextResponse.json({ error: `Could not read products: ${loaded.error}` }, { status: 503 });

  const rows = loaded.map(toCatalogueRow);
  const groups = findDuplicateGroups(rows, dismissed.pairs);
  const byId = new Map(loaded.map((r) => [String(r.id), r]));

  return NextResponse.json({
    scanned: rows.length,
    dismissalsAvailable: dismissed.available,
    groups: groups.map((g) => ({
      keepId: g.keepId,
      reasons: g.reasons,
      products: g.ids.map((id) => {
        const r = byId.get(id)!;
        const images = Array.isArray(r.images) ? (r.images as string[]) : [];
        return {
          id,
          name: String(r.name ?? ""),
          brand: String(r.brand ?? ""),
          category: (r.category as string | null) ?? null,
          color: Array.isArray(r.colors) ? String((r.colors as string[])[0] ?? "") : "",
          image: String(r.image_url || images[0] || ""),
          priceMin: Number(r.price_min) || 0,
          sourceUrl: (r.source_url as string | null) ?? null,
          createdAt: (r.created_at as string | null) ?? null,
          stores: (Array.isArray(r.retailers) ? (r.retailers as Retailer[]) : []).map((s) => ({
            name: s.name,
            url: s.url,
            price: s.price,
            currency: s.currency,
            isOfficial: !!s.isOfficial,
          })),
        };
      }),
    })),
  });
}

// ── Merge ────────────────────────────────────────────────────────────────────

interface Repointed {
  likes: number;
  outfits: number;
  looks: number;
  pendingLooks: number;
  groupPrimaries: number;
  skipped: string[];
}

/**
 * Moves every reference to the removed cards onto the kept one. Each kind is
 * best-effort and reported: a table this database does not have is skipped,
 * not a failure — but a failed write stops the merge before anything is
 * deleted, so nothing is left pointing at a card that no longer exists.
 */
async function repoint(keepId: string, mergeIds: string[]): Promise<Repointed | { error: string }> {
  const from = new Set(mergeIds);
  const out: Repointed = { likes: 0, outfits: 0, looks: 0, pendingLooks: 0, groupPrimaries: 0, skipped: [] };

  // Likes: one per user and product, so a user who liked both keeps one.
  {
    const { data, error } = await supabase!
      .from("user_likes")
      .select("id, user_id, entity_id")
      .eq("entity_type", "product")
      .in("entity_id", [keepId, ...mergeIds]);
    if (isMissingTableLoose(error)) out.skipped.push("user_likes");
    else if (error) return { error: `likes: ${error.message}` };
    else {
      const rows = (data ?? []) as { id: string; user_id: string; entity_id: string }[];
      const likesKeep = new Set(rows.filter((r) => r.entity_id === keepId).map((r) => r.user_id));
      for (const like of rows.filter((r) => from.has(r.entity_id))) {
        const write = likesKeep.has(like.user_id)
          ? supabase!.from("user_likes").delete().eq("id", like.id)
          : supabase!.from("user_likes").update({ entity_id: keepId }).eq("id", like.id);
        const { error: e } = await write;
        if (e) return { error: `likes: ${e.message}` };
        likesKeep.add(like.user_id);
        out.likes++;
      }
    }
  }

  // Outfits, saved looks, submitted looks: JSON lists of pieces.
  const lists: { table: string; column: string; key: string; count: keyof Repointed }[] = [
    { table: "outfits", column: "items", key: "product_id", count: "outfits" },
    { table: "user_looks", column: "pieces", key: "productId", count: "looks" },
    { table: "pending_looks", column: "pieces", key: "productId", count: "pendingLooks" },
  ];
  for (const { table, column, key, count } of lists) {
    const rows: { id: string; [k: string]: unknown }[] = [];
    let missing = false;
    for (const id of mergeIds) {
      // As a JSON string: supabase-js writes a JS array as a Postgres array
      // literal ("{[object Object]}"), which a jsonb column never contains.
      const { data, error } = await supabase!
        .from(table)
        .select(`id, ${column}`)
        .contains(column, JSON.stringify([{ [key]: id }]));
      if (isMissingTableLoose(error)) {
        missing = true;
        break;
      }
      if (error) return { error: `${table}: ${error.message}` };
      for (const r of (data ?? []) as unknown as { id: string }[]) if (!rows.some((x) => x.id === r.id)) rows.push(r);
    }
    if (missing) {
      out.skipped.push(table);
      continue;
    }
    for (const r of rows) {
      const items = Array.isArray(r[column]) ? (r[column] as Record<string, unknown>[]) : [];
      const next = repointItems(items, key, from, keepId);
      if (!next.changed) continue;
      const { error } = await supabase!.from(table).update({ [column]: next.items }).eq("id", r.id);
      if (error) return { error: `${table}: ${error.message}` };
      (out[count] as number)++;
    }
  }

  // A removed card that led its colour group hands the lead to another member,
  // or the group would render without a primary.
  {
    const { data, error } = await supabase!
      .from("products")
      .select("id, variant_group_id, is_group_primary")
      .in("id", mergeIds);
    if (!error) {
      for (const r of (data ?? []) as { id: string; variant_group_id: string | null; is_group_primary: boolean | null }[]) {
        if (!r.is_group_primary || !r.variant_group_id) continue;
        const { data: members } = await supabase!
          .from("products")
          .select("id")
          .eq("variant_group_id", r.variant_group_id)
          .order("id")
          .limit(50);
        const heir = ((members ?? []) as { id: string }[]).find((m) => !from.has(m.id));
        if (!heir) continue;
        const { error: e } = await supabase!.from("products").update({ is_group_primary: true }).eq("id", heir.id);
        if (!e) out.groupPrimaries++;
      }
    }
  }

  return out;
}

async function merge(adminId: string, keepId: string, mergeIds: string[]) {
  const ids = [keepId, ...mergeIds];
  const { data, error } = await supabase!.from("products").select("*").in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as ProductRow[];
  const keep = rows.find((r) => String(r.id) === keepId);
  const others = rows.filter((r) => String(r.id) !== keepId);
  if (!keep || others.length !== mergeIds.length) {
    return NextResponse.json({ error: "One of these products no longer exists — reload the list." }, { status: 409 });
  }

  const { patch, filled } = mergeCardsPatch(keep, others);
  if (Object.keys(patch).length) {
    const { error: writeError } = await writeProductRow<{ id: string }>(patch, (row) =>
      supabase!.from("products").update(row).eq("id", keepId).select("id").maybeSingle(),
    );
    if (writeError) return NextResponse.json({ error: `Could not update the kept product: ${writeError.message}` }, { status: 500 });
  }

  const moved = await repoint(keepId, mergeIds);
  if ("error" in moved) {
    // The kept card already carries the stores; the others stay until their
    // references can be moved, so a retry finishes the job.
    return NextResponse.json({ error: `Could not move references (${moved.error}); nothing was deleted.` }, { status: 500 });
  }

  const { error: deleteError } = await supabase!.from("products").delete().in("id", mergeIds);
  if (deleteError) return NextResponse.json({ error: `Could not remove the merged products: ${deleteError.message}` }, { status: 500 });

  await logAdminAction({
    admin_id: adminId,
    action: "products.duplicates_merged",
    target_type: "product",
    target_id: keepId,
    metadata: {
      kept: { id: keepId, name: keep.name },
      removed: others.map((o) => ({ id: o.id, name: o.name, source_url: o.source_url, retailers: o.retailers })),
      filled,
      moved,
    },
  });
  revalidatePath("/");

  return NextResponse.json({ ok: true, keepId, removed: mergeIds, filled, moved });
}

// ── Dismiss ──────────────────────────────────────────────────────────────────

/**
 * Remembers cards as different items. With `against`, only each of `ids`
 * against each of `against` is remembered — the cards unticked in a group
 * against the ones kept together — so the rest of the group stays a proposal.
 * Without it, every pair among `ids` is.
 */
async function dismiss(adminId: string, ids: string[], against: string[]) {
  const pairs = new Map<string, [string, string]>();
  const add = (x: string, y: string) => {
    if (x === y) return;
    const [a, b] = x < y ? [x, y] : [y, x];
    pairs.set(pairKey(a, b), [a, b]);
  };
  if (against.length) {
    for (const x of ids) for (const y of against) add(x, y);
  } else {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) add(ids[i], ids[j]);
  }
  const rows = [...pairs.values()].map(([a, b]) => ({
    product_id: a,
    field: DISMISS_FIELD,
    stored: b,
    suggested: "",
    dismissed_by: adminId,
  }));
  const { error } = await supabase!
    .from(DISMISSALS)
    .upsert(rows, { onConflict: "product_id,field,stored,suggested", ignoreDuplicates: true });
  if (isMissingTableLoose(error)) {
    return NextResponse.json(
      { error: "Remembering \"not duplicates\" needs supabase/migrations/012_label_audit_dismissals.sql — run it, then try again." },
      { status: 503 },
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction({
    admin_id: adminId,
    action: "products.duplicates_dismissed",
    target_type: "product",
    target_id: ids[0],
    metadata: against.length ? { ids, against } : { ids },
  });
  return NextResponse.json({ ok: true, pairs: rows.length });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const clean = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim()).filter(Boolean);

  if (body?.action === "merge") {
    const keepId = String(body?.keepId ?? "").trim();
    const mergeIds = [...new Set(clean(body?.mergeIds))].filter((id) => id !== keepId).slice(0, 20);
    if (!keepId || !mergeIds.length) return NextResponse.json({ error: "keepId and mergeIds are required" }, { status: 400 });
    return merge(admin.userId, keepId, mergeIds);
  }
  if (body?.action === "dismiss") {
    const ids = [...new Set(clean(body?.ids))].slice(0, 20);
    const against = [...new Set(clean(body?.against))].filter((id) => !ids.includes(id)).slice(0, 20);
    if (against.length ? !ids.length : ids.length < 2) {
      return NextResponse.json({ error: "At least two ids are required" }, { status: 400 });
    }
    return dismiss(admin.userId, ids, against);
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
