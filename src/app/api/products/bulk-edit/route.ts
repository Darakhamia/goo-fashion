/**
 * Applies one set of changes to many products at once.
 *
 * Only the fields named in the request are written, and only the columns they
 * map to — never a whole product row. A bulk edit that rewrote every column
 * would blank whatever the caller did not happen to send, across everything
 * selected, which is the one mistake here that could not be walked back.
 *
 * Three kinds of change, because they need different things:
 *
 *   set   — the same value on every product (brand, gender, category…). One
 *           statement over all the ids.
 *   add   — appended to what is already there (colour groups, style keywords),
 *           so a piece that is two colours keeps both. Needs each row read
 *           first, so it runs per product.
 *   name  — a prefix, a suffix, or a find-and-replace. Setting one identical
 *           name across a selection is not offered: it is never what someone
 *           means, and it destroys the names it overwrites.
 *
 *   PATCH /api/products/bulk-edit
 *   { ids: [...], set?: {...}, add?: {...}, name?: { prefix?, suffix?, find?, replace? } }
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { loadCategoryTree } from "@/lib/server/category-tree";
import { subcategoryToValue } from "@/lib/categories";
import type { StyleKeyword } from "@/lib/types";
import { mergeUnique, nextName } from "@/lib/server/bulk-edit";

export const dynamic = "force-dynamic";

/** Kept in step with the `StyleKeyword` union by the `satisfies` clause. */
const STYLE_KEYWORDS = [
  "minimal", "streetwear", "classic", "avant-garde", "romantic", "utilitarian",
  "bohemian", "preppy", "sporty", "dark", "maximalist", "coastal", "academic",
] as const satisfies readonly StyleKeyword[];

const GENDERS = new Set(["women", "men", "unisex"]);
/** Enough to be useful, few enough that one mistake stays reviewable. */
const MAX_IDS = 500;

interface BulkBody {
  ids?: unknown;
  set?: Record<string, unknown>;
  add?: Record<string, unknown>;
  name?: { prefix?: unknown; suffix?: unknown; find?: unknown; replace?: unknown };
}

type Row = {
  id: string;
  name: string;
  color_group_ids: number[] | null;
  style_keywords: string[] | null;
};

function uniqueStrings(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
}

function uniqueNumbers(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return [...new Set(list.map((v) => Number(v)).filter((n) => Number.isFinite(n)))];
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as BulkBody;
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  if (!ids.length) return NextResponse.json({ error: "Nothing selected." }, { status: 400 });
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Too many at once — ${MAX_IDS} is the limit.` }, { status: 400 });
  }

  const tree = await loadCategoryTree();
  const labelToValue = subcategoryToValue(tree.groups);

  /* ── The same value everywhere ─────────────────────────────────────────── */

  const shared: Record<string, unknown> = {};
  const set = body.set ?? {};

  if (typeof set.brand === "string" && set.brand.trim()) shared.brand = set.brand.trim();

  if (set.gender !== undefined) {
    const gender = String(set.gender).trim();
    // Empty clears it, which is a real thing to want after a bad import.
    if (gender && !GENDERS.has(gender)) {
      return NextResponse.json({ error: `"${gender}" is not a gender.` }, { status: 400 });
    }
    shared.gender = gender || null;
  }

  if (set.subcategory !== undefined) {
    const label = String(set.subcategory).trim();
    if (label) {
      const category = labelToValue[label];
      if (category === undefined) {
        return NextResponse.json(
          { error: `"${label}" is not a subcategory in the category tree.` },
          { status: 400 },
        );
      }
      // The category follows from the tree, exactly as it does everywhere else,
      // so a bulk edit cannot leave the pair contradicting itself.
      shared.subcategory = label;
      shared.category = category;
    } else {
      shared.subcategory = null;
    }
  }

  if (set.styleKeywords !== undefined) {
    const keywords = uniqueStrings(set.styleKeywords);
    const unknown = keywords.find((k) => !(STYLE_KEYWORDS as readonly string[]).includes(k));
    if (unknown) return NextResponse.json({ error: `"${unknown}" is not a style keyword.` }, { status: 400 });
    shared.style_keywords = keywords;
  }

  if (set.colorGroupIds !== undefined) {
    shared.color_group_ids = uniqueNumbers(set.colorGroupIds);
  }

  /* ── Appended to what is already there ─────────────────────────────────── */

  const addStyles = body.add?.styleKeywords !== undefined ? uniqueStrings(body.add.styleKeywords) : null;
  const addGroups = body.add?.colorGroupIds !== undefined ? uniqueNumbers(body.add.colorGroupIds) : null;
  if (addStyles) {
    const unknown = addStyles.find((k) => !(STYLE_KEYWORDS as readonly string[]).includes(k));
    if (unknown) return NextResponse.json({ error: `"${unknown}" is not a style keyword.` }, { status: 400 });
  }

  /* ── Names ─────────────────────────────────────────────────────────────── */

  const prefix = String(body.name?.prefix ?? "");
  const suffix = String(body.name?.suffix ?? "");
  const find = String(body.name?.find ?? "");
  const replace = String(body.name?.replace ?? "");
  const touchesName = !!(prefix || suffix || find);

  const perRow = !!(addStyles || addGroups || touchesName);
  if (!Object.keys(shared).length && !perRow) {
    return NextResponse.json({ error: "No changes given." }, { status: 400 });
  }

  let updated = 0;
  const failures: { id: string; error: string }[] = [];

  if (!perRow) {
    // Nothing depends on a product's current value, so one statement does it.
    const { data, error } = await supabase.from("products").update(shared).in("id", ids).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated = (data ?? []).length;
  } else {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, color_group_ids, style_keywords")
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const row of (data ?? []) as Row[]) {
      const patch: Record<string, unknown> = { ...shared };

      if (addStyles) patch.style_keywords = mergeUnique(row.style_keywords, addStyles);
      if (addGroups) patch.color_group_ids = mergeUnique(row.color_group_ids, addGroups);
      if (touchesName) {
        const next = nextName(row.name, { prefix, suffix, find, replace });
        if (next && next !== row.name) patch.name = next;
      }

      if (!Object.keys(patch).length) continue;
      const { error: writeError } = await supabase.from("products").update(patch).eq("id", row.id);
      if (writeError) failures.push({ id: row.id, error: writeError.message });
      else updated++;
    }
  }

  await supabase.from("admin_audit_log").insert({
    admin_id: admin.userId,
    action: "products.bulk_edited",
    target_type: "products",
    metadata: { count: ids.length, updated, set: shared, add: body.add ?? null, name: body.name ?? null },
  });

  revalidatePath("/browse");
  return NextResponse.json({ updated, requested: ids.length, failures });
}
