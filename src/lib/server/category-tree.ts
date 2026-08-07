/**
 * Reads the category tree out of the database.
 *
 * The tables arrived with migration 011. Until it runs — and whenever the
 * database is unreachable — this hands back the tree hardcoded in
 * `src/lib/categories.ts`, so the storefront keeps its filters either way and
 * the admin panel can say which of the two it is showing.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_CATEGORY_GROUPS, type CategoryGroup } from "@/lib/categories";

export type TreeSource = "db" | "default";

export interface CategoryTree {
  groups: CategoryGroup[];
  source: TreeSource;
  /** Why the default is being served, when it is. */
  reason?: "no-database" | "tables-missing";
}

type GroupRow = { id: string; label: string; sort_order: number };
type SubRow = { id: number; group_id: string; label: string; value: string; sort_order: number };

export async function loadCategoryTree(): Promise<CategoryTree> {
  if (!isSupabaseConfigured || !supabase) {
    return { groups: DEFAULT_CATEGORY_GROUPS, source: "default", reason: "no-database" };
  }

  const [groupsRes, subsRes] = await Promise.all([
    supabase.from("category_groups").select("id, label, sort_order").order("sort_order"),
    supabase
      .from("category_subcategories")
      .select("id, group_id, label, value, sort_order")
      .order("sort_order"),
  ]);

  // Either table missing means the migration has not run; a half-created tree
  // is not worth rendering, so fall back as a whole.
  if (groupsRes.error || subsRes.error) {
    return { groups: DEFAULT_CATEGORY_GROUPS, source: "default", reason: "tables-missing" };
  }

  const groupRows = (groupsRes.data ?? []) as GroupRow[];
  // An empty table is a tree an admin emptied out, not a broken one — but a
  // storefront with no filters at all is never what they meant, so treat it
  // like a missing table and keep the default visible.
  if (groupRows.length === 0) {
    return { groups: DEFAULT_CATEGORY_GROUPS, source: "default", reason: "tables-missing" };
  }

  const subRows = (subsRes.data ?? []) as SubRow[];
  const groups: CategoryGroup[] = groupRows.map((g) => ({
    id: g.id,
    label: g.label,
    items: subRows
      .filter((s) => s.group_id === g.id)
      .map((s) => ({ id: s.id, label: s.label, value: s.value })),
  }));

  return { groups, source: "db" };
}

/**
 * How many products sit under each subcategory label, plus how many in each
 * category value still have none.
 *
 * The admin panel shows both next to the tree: the first says whether a label
 * is worth keeping, the second says how much of the catalog is still waiting
 * to be sorted into one.
 */
export async function loadSubcategoryCounts(): Promise<{
  byLabel: Record<string, number>;
  unassignedByCategory: Record<string, number>;
}> {
  const empty = { byLabel: {}, unassignedByCategory: {} };
  if (!isSupabaseConfigured || !supabase) return empty;

  const byLabel: Record<string, number> = {};
  const unassignedByCategory: Record<string, number> = {};
  const PAGE = 1000;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("products")
      .select("category, subcategory")
      // Paging without an order lets Postgres return rows in any order it
      // likes, which double-counts some and drops others across pages.
      .order("id")
      .range(from, from + PAGE - 1);
    // Most likely the `subcategory` column itself is missing (migration 010).
    // Counts are decoration here — the tree editor still works without them.
    if (error) return empty;

    const rows = (data ?? []) as { category: string | null; subcategory: string | null }[];
    for (const row of rows) {
      if (row.subcategory) {
        byLabel[row.subcategory] = (byLabel[row.subcategory] ?? 0) + 1;
      } else if (row.category) {
        unassignedByCategory[row.category] = (unassignedByCategory[row.category] ?? 0) + 1;
      }
    }
    if (rows.length < PAGE) break;
  }

  return { byLabel, unassignedByCategory };
}
