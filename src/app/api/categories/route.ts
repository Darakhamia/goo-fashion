/**
 * The category tree: read by the storefront, edited by the admin panel.
 *
 *   GET    /api/categories            → { groups, source }
 *   GET    /api/categories?counts=1   → also { counts } (admin panel)
 *   POST   /api/categories            → create a group or a subcategory
 *   PATCH  /api/categories            → rename / re-point / move / reorder one
 *   DELETE /api/categories?kind=…&id=… → remove one
 *
 * Writes carry a `kind` rather than living at separate paths, because a group
 * and a subcategory are two halves of one tree and every edit to either has to
 * reason about the products underneath it.
 *
 * Products store the subcategory *label* as text and the category *value* as
 * their bucket, so an edit to either field on a subcategory row would strand
 * the rows that already point at it. Each handler below carries its products
 * along and reports how many it touched.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { loadCategoryTree, loadSubcategoryCounts } from "@/lib/server/category-tree";
import { normalizeSlug, isValidSlug } from "@/lib/categories";

export const dynamic = "force-dynamic";

/** Postgres undefined_table, and PostgREST's "no such table in schema cache". */
function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    !!error.message?.includes("does not exist")
  );
}

function tableMissingResponse() {
  return NextResponse.json(
    { error: "Category tables not found. Run migration 011.", code: "TABLE_MISSING" },
    { status: 503 },
  );
}

type Guard = { userId: string } | NextResponse;

async function guard(): Promise<Guard> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured.", code: "NO_DB" }, { status: 501 });
  }
  return admin;
}

function cleanLabel(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}

/**
 * A subcategory's bucket, normalized.
 *
 * Any slug is allowed, not just the ones in `CATEGORY_VALUES`: the admin panel
 * can invent a bucket for a group the built-in list has no name for. It works
 * everywhere the catalog reads the tree; the importer's classifier and the
 * outfit builder only know the built-in ones, which the editor says out loud
 * before you pick one.
 */
function readBucket(raw: unknown): { value: string } | { error: string } {
  const value = normalizeSlug(raw);
  if (!value) return { error: "Pick a category value." };
  if (!isValidSlug(value)) {
    return { error: `"${value}" is not a usable category value — letters, digits and dashes, 2–32 characters.` };
  }
  return { value };
}

/**
 * Rewrites the products a subcategory edit leaves behind.
 *
 * Returns how many rows moved. A missing `subcategory` column (migration 010
 * not run) is not an error here — there is simply nothing pointing at the
 * label yet.
 */
async function repointProducts(
  match: { label: string; value?: string },
  patch: Record<string, string | null>,
): Promise<number> {
  let q = supabase!.from("products").update(patch).eq("subcategory", match.label);
  if (match.value) q = q.eq("category", match.value);
  const { data, error } = await q.select("id");
  if (error) return 0;
  return (data ?? []).length;
}

export async function GET(req: Request) {
  const tree = await loadCategoryTree();
  const wantCounts = new URL(req.url).searchParams.get("counts") === "1";
  if (!wantCounts) return NextResponse.json(tree);
  return NextResponse.json({ ...tree, counts: await loadSubcategoryCounts() });
}

export async function POST(req: Request) {
  const admin = await guard();
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "group" ? "group" : "subcategory";

  if (kind === "group") {
    const id = normalizeSlug(body.id ?? body.label);
    const label = cleanLabel(body.label);
    if (!id || !label) {
      return NextResponse.json({ error: "A group needs a name." }, { status: 400 });
    }
    const { data, error } = await supabase!
      .from("category_groups")
      .insert({ id, label, sort_order: Number(body.sortOrder) || 0 })
      .select()
      .single();
    if (error) {
      if (isTableMissing(error)) return tableMissingResponse();
      if (error.code === "23505") {
        return NextResponse.json({ error: `Group "${id}" already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await logAdminAction({
      admin_id: admin.userId,
      action: "categories.updated",
      target_id: id,
      target_type: "category_group",
      metadata: { op: "create", label },
    });
    revalidatePath("/browse");
    return NextResponse.json(data, { status: 201 });
  }

  const label = cleanLabel(body.label);
  const groupId = normalizeSlug(body.groupId);
  if (!label) return NextResponse.json({ error: "A subcategory needs a name." }, { status: 400 });
  if (!groupId) return NextResponse.json({ error: "Pick a group." }, { status: 400 });
  const bucket = readBucket(body.value);
  if ("error" in bucket) return NextResponse.json({ error: bucket.error }, { status: 400 });
  const value = bucket.value;

  const { data, error } = await supabase!
    .from("category_subcategories")
    .insert({ group_id: groupId, label, value, sort_order: Number(body.sortOrder) || 0 })
    .select()
    .single();
  if (error) {
    if (isTableMissing(error)) return tableMissingResponse();
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `"${label}" already exists — a label can only appear once in the tree.` },
        { status: 409 },
      );
    }
    if (error.code === "23503") {
      return NextResponse.json({ error: `Group "${groupId}" does not exist.` }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "categories.updated",
    target_id: String(data.id),
    target_type: "category_subcategory",
    metadata: { op: "create", label, value, groupId },
  });
  revalidatePath("/browse");
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: Request) {
  const admin = await guard();
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "group" ? "group" : "subcategory";

  if (kind === "group") {
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Which group?" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (body.label !== undefined) {
      const label = cleanLabel(body.label);
      if (!label) return NextResponse.json({ error: "A group needs a name." }, { status: 400 });
      patch.label = label;
    }
    if (body.sortOrder !== undefined) patch.sort_order = Number(body.sortOrder) || 0;
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

    const { data, error } = await supabase!
      .from("category_groups")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (isTableMissing(error)) return tableMissingResponse();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await logAdminAction({
      admin_id: admin.userId,
      action: "categories.updated",
      target_id: id,
      target_type: "category_group",
      metadata: { op: "update", ...patch },
    });
    revalidatePath("/browse");
    return NextResponse.json(data);
  }

  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Which subcategory?" }, { status: 400 });

  const current = await supabase!
    .from("category_subcategories")
    .select("id, group_id, label, value, sort_order")
    .eq("id", id)
    .single();
  if (current.error) {
    if (isTableMissing(current.error)) return tableMissingResponse();
    return NextResponse.json({ error: "Subcategory not found." }, { status: 404 });
  }
  const before = current.data as { group_id: string; label: string; value: string };

  const patch: Record<string, unknown> = {};
  if (body.label !== undefined) {
    const label = cleanLabel(body.label);
    if (!label) return NextResponse.json({ error: "A subcategory needs a name." }, { status: 400 });
    patch.label = label;
  }
  if (body.value !== undefined) {
    const bucket = readBucket(body.value);
    if ("error" in bucket) return NextResponse.json({ error: bucket.error }, { status: 400 });
    patch.value = bucket.value;
  }
  if (body.groupId !== undefined) {
    const groupId = normalizeSlug(body.groupId);
    if (!groupId) return NextResponse.json({ error: "Pick a group." }, { status: 400 });
    patch.group_id = groupId;
  }
  if (body.sortOrder !== undefined) patch.sort_order = Number(body.sortOrder) || 0;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { data, error } = await supabase!
    .from("category_subcategories")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (isTableMissing(error)) return tableMissingResponse();
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `"${patch.label}" already exists elsewhere in the tree.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Carry the products along. Renaming the label and re-pointing the value are
  // separate rewrites, and both are matched on what the row said *before* this
  // edit — otherwise the products would be looking for a label that no longer
  // exists.
  const productPatch: Record<string, string | null> = {};
  if (patch.label && patch.label !== before.label) productPatch.subcategory = patch.label as string;
  if (patch.value && patch.value !== before.value) productPatch.category = patch.value as string;
  const productsUpdated = Object.keys(productPatch).length
    ? await repointProducts({ label: before.label, value: before.value }, productPatch)
    : 0;

  await logAdminAction({
    admin_id: admin.userId,
    action: "categories.updated",
    target_id: String(id),
    target_type: "category_subcategory",
    metadata: { op: "update", before, after: patch, productsUpdated },
  });
  revalidatePath("/browse");
  return NextResponse.json({ ...data, productsUpdated });
}

export async function DELETE(req: Request) {
  const admin = await guard();
  if (admin instanceof NextResponse) return admin;

  const params = new URL(req.url).searchParams;
  const kind = params.get("kind") === "group" ? "group" : "subcategory";
  const rawId = params.get("id") ?? "";
  if (!rawId) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  if (kind === "group") {
    // The table cascades, which would silently take every subcategory — and
    // the products' labels with them. Make the admin empty it first.
    const children = await supabase!
      .from("category_subcategories")
      .select("id")
      .eq("group_id", rawId);
    if (children.error && isTableMissing(children.error)) return tableMissingResponse();
    if ((children.data ?? []).length > 0) {
      return NextResponse.json(
        {
          error: `"${rawId}" still holds ${children.data!.length} subcategor${
            children.data!.length === 1 ? "y" : "ies"
          }. Move or delete them first.`,
        },
        { status: 409 },
      );
    }
    const { error } = await supabase!.from("category_groups").delete().eq("id", rawId);
    if (error) {
      if (isTableMissing(error)) return tableMissingResponse();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await logAdminAction({
      admin_id: admin.userId,
      action: "categories.updated",
      target_id: rawId,
      target_type: "category_group",
      metadata: { op: "delete" },
    });
    revalidatePath("/browse");
    return NextResponse.json({ ok: true });
  }

  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Which subcategory?" }, { status: 400 });

  const current = await supabase!
    .from("category_subcategories")
    .select("label, value")
    .eq("id", id)
    .single();
  if (current.error) {
    if (isTableMissing(current.error)) return tableMissingResponse();
    return NextResponse.json({ error: "Subcategory not found." }, { status: 404 });
  }
  const { label, value } = current.data as { label: string; value: string };

  const { error } = await supabase!.from("category_subcategories").delete().eq("id", id);
  if (error) {
    if (isTableMissing(error)) return tableMissingResponse();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear the label off its products rather than leaving them pointing at a
  // subcategory that no longer exists. They keep their category, so they stay
  // in the catalog and answer to their whole group again.
  const productsUpdated = await repointProducts({ label, value }, { subcategory: null });

  await logAdminAction({
    admin_id: admin.userId,
    action: "categories.updated",
    target_id: String(id),
    target_type: "category_subcategory",
    metadata: { op: "delete", label, value, productsUpdated },
  });
  revalidatePath("/browse");
  return NextResponse.json({ ok: true, productsUpdated });
}
