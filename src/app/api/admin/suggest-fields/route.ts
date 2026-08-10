/**
 * Proposes field values for a product being edited. Read-only — it answers,
 * the editor decides and writes.
 *
 * The catalogue is the model here, so it is loaded and mined per request. That
 * is a few hundred rows and a few milliseconds, but a data-entry session asks
 * repeatedly while the catalogue sits still, so the mined rules are cached for
 * a minute. Nothing is ever stale for long enough to matter: the worst case is
 * a suggestion drawn from the catalogue as it was sixty seconds ago.
 *
 *   POST /api/admin/suggest-fields
 *   { name, description?, brand?, colors?, category?, subcategory?, gender?, colorGroups? }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { loadCategoryTree } from "@/lib/server/category-tree";
import { loadLabelledProducts, type LabelledProduct } from "@/lib/server/catalogue-labels";
import {
  mineSuggestionRules,
  suggestFields,
  type DraftProduct,
  type SuggestionRules,
} from "@/lib/server/field-suggestions";
import type { CategoryGroup } from "@/lib/categories";

export const dynamic = "force-dynamic";

const CACHE_MS = 60_000;

let cache:
  | { at: number; catalogue: LabelledProduct[]; tree: CategoryGroup[]; rules: SuggestionRules }
  | null = null;

async function model() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const [loaded, tree] = await Promise.all([loadLabelledProducts(), loadCategoryTree()]);
  if ("error" in loaded) return { error: loaded.error };
  const fresh = {
    at: Date.now(),
    catalogue: loaded,
    tree: tree.groups,
    rules: mineSuggestionRules(loaded),
  };
  cache = fresh;
  return fresh;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<DraftProduct>;
  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "A name is needed — that is what the suggestions read." },
      { status: 400 },
    );
  }

  const built = await model();
  if ("error" in built) {
    return NextResponse.json({ error: `Could not read the catalogue: ${built.error}` }, { status: 503 });
  }

  const draft: DraftProduct = {
    name: body.name,
    description: body.description ?? "",
    brand: body.brand ?? "",
    colors: body.colors ?? [],
    category: body.category ?? "",
    subcategory: body.subcategory ?? "",
    gender: body.gender ?? "",
    colorGroups: body.colorGroups ?? [],
  };

  const suggestions = suggestFields(draft, built.catalogue, built.tree, built.rules);
  return NextResponse.json({
    suggestions,
    learnedFrom: built.catalogue.length,
  });
}
