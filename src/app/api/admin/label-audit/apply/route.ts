/**
 * Applies one of the audit's suggestions to one product.
 *
 * Deliberately one product and one field per call. The audit exists because a
 * rule disagreeing with a label means one of the two is wrong, and which one
 * is a judgement — so every correction costs an explicit click against visible
 * evidence. There is no "apply all" here and there should not be.
 *
 * Writes only the column being corrected, never a whole product row, so a fix
 * cannot take anything else with it.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { loadCategoryTree } from "@/lib/server/category-tree";
import { subcategoryToValue } from "@/lib/categories";
import { colorGroupNamesFor, colorToHex, repairColourLabels } from "@/lib/server/product-fields";

export const dynamic = "force-dynamic";

const GENDERS = new Set(["women", "men", "unisex"]);

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  const field = String(body.field ?? "").trim();
  const value = String(body.value ?? "").trim();
  if (!id || !field || !value) {
    return NextResponse.json({ error: "Need a product, a field and a value." }, { status: 400 });
  }

  const current = await supabase
    .from("products")
    .select("id, name, category, subcategory, gender, color_group_ids, colors")
    .eq("id", id)
    .limit(1);
  if (current.error) {
    return NextResponse.json({ error: current.error.message }, { status: 503 });
  }
  const product = (current.data ?? [])[0] as
    | {
        id: string;
        name: string;
        category: string;
        subcategory: string | null;
        gender: string | null;
        color_group_ids: number[] | null;
        colors: string[] | null;
      }
    | undefined;
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const tree = await loadCategoryTree();
  const labelToValue = subcategoryToValue(tree.groups);

  const patch: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};

  if (field === "subcategory") {
    const category = labelToValue[value];
    if (category === undefined) {
      return NextResponse.json(
        { error: `"${value}" is not a subcategory in the category tree.` },
        { status: 400 },
      );
    }
    // Both fields, because the tree already says which category this label
    // belongs to. Writing the label alone would leave the pair contradicting
    // itself — the exact inconsistency the audit's first check reports.
    patch.subcategory = value;
    patch.category = category;
    before.subcategory = product.subcategory;
    before.category = product.category;
  } else if (field === "category") {
    const known = new Set(Object.values(labelToValue));
    if (!known.has(value)) {
      return NextResponse.json(
        { error: `No subcategory in the tree is filed under "${value}".` },
        { status: 400 },
      );
    }
    // Changing the category alone under a subcategory that belongs elsewhere
    // would create a contradiction. The subcategory suggestion fixes both at
    // once, so send the editor there rather than making the catalogue worse.
    if (product.subcategory && labelToValue[product.subcategory] !== value) {
      return NextResponse.json(
        {
          error: `This piece is filed as "${product.subcategory}", which belongs to ${labelToValue[product.subcategory] ?? "no category"}. Fix the subcategory instead — that sets both.`,
        },
        { status: 409 },
      );
    }
    patch.category = value;
    before.category = product.category;
  } else if (field === "gender") {
    if (!GENDERS.has(value)) {
      return NextResponse.json({ error: `"${value}" is not a gender.` }, { status: 400 });
    }
    patch.gender = value;
    before.gender = product.gender;
  } else if (field === "colour group") {
    const groups = await supabase.from("color_groups").select("id, name");
    const match = ((groups.data ?? []) as { id: number; name: string }[]).find(
      (g) => g.name.toLowerCase() === value.toLowerCase(),
    );
    if (!match) {
      return NextResponse.json({ error: `No colour group called "${value}".` }, { status: 400 });
    }
    const existing = product.color_group_ids ?? [];
    if (existing.includes(match.id)) {
      return NextResponse.json({ error: `Already filed under ${value}.` }, { status: 409 });
    }
    // Added to what is there rather than replacing it: a piece can be two
    // colours, and the audit only ever reports a group as *missing*.
    patch.color_group_ids = [...existing, match.id];
    before.color_group_ids = existing;
  } else if (field === "colour") {
    // Recomputed here rather than taken from the request: the audit's
    // suggestion is only confirmed, so a label edited since the check is not
    // overwritten with a repair meant for what it used to say.
    const repair = repairColourLabels(product.name, product.colors ?? []);
    if (!repair) {
      return NextResponse.json({ error: "Every colour on this piece is a colour already." }, { status: 409 });
    }
    const expected = repair.next.join(", ") || "(none)";
    if (value !== expected) {
      return NextResponse.json({ error: "The colour changed since the check. Re-check and try again." }, { status: 409 });
    }
    patch.colors = repair.next;
    patch.color_hex = repair.next[0] ? colorToHex(repair.next[0]) : null;
    before.colors = product.colors;
    // The filter too, when the piece had none: the size never filed it anywhere.
    const existing = product.color_group_ids ?? [];
    if (!existing.length && repair.next.length) {
      const wanted = colorGroupNamesFor(repair.next, "field").map((n) => n.toLowerCase());
      const groups = await supabase.from("color_groups").select("id, name");
      const ids = ((groups.data ?? []) as { id: number; name: string }[])
        .filter((g) => wanted.includes(g.name.toLowerCase()))
        .map((g) => g.id);
      if (ids.length) {
        patch.color_group_ids = ids;
        before.color_group_ids = existing;
      }
    }
  } else {
    return NextResponse.json({ error: `Cannot apply a fix to "${field}".` }, { status: 400 });
  }

  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_audit_log").insert({
    admin_id: admin.userId,
    action: "products.label_fixed",
    target_id: id,
    target_type: "product",
    metadata: { name: product.name, field, before, after: patch },
  });

  revalidatePath("/browse");
  return NextResponse.json({ ok: true, id, patch, before });
}
