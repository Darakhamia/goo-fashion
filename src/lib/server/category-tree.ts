/**
 * Reads the category tree out of the database.
 *
 * The tables arrived with migration 011. Until it runs — and whenever the
 * database is unreachable or the tree is empty — this hands back the tree
 * hardcoded in `src/lib/categories.ts`, so the storefront keeps its filters
 * either way and the admin panel can say which of the two it is showing, and
 * why.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_CATEGORY_GROUPS, type CategoryGroup, type CategoryItem } from "@/lib/categories";

export type TreeSource = "db" | "default";

export interface CategoryTree {
  groups: CategoryGroup[];
  source: TreeSource;
  /**
   * Why the default is being served, when it is. `tables-empty` is a tree an
   * admin emptied out: still the database's, and still editable.
   */
  reason?: "no-database" | "tables-missing" | "tables-empty" | "read-failed";
  /** The database's own words, when `reason` is `read-failed`. */
  detail?: string;
}

/** Postgres undefined_table, and PostgREST's "no such table in schema cache". */
function isTableMissing(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /relation .+ does not exist/i.test(error.message ?? "");
}

type GroupRow = { id: string; label: string; sort_order: number };
type SubRow = {
  id: number;
  group_id: string;
  label: string;
  value: string;
  sort_order: number;
  size_type?: string | null;
  sizes?: string[] | null;
};

const SUB_COLUMNS = "id, group_id, label, value, sort_order, size_type, sizes";
/** Without the size chart, for a database that has not run migration 013. */
const SUB_COLUMNS_LEGACY = "id, group_id, label, value, sort_order";

/**
 * Reads the subcategories, retrying without the size columns if they are not
 * there yet. Deploying ahead of a migration should cost the size charts, not
 * the entire category tree.
 */
async function selectSubcategories() {
  // `id` breaks ties, so two rows with one sort_order keep a stable order.
  const full = await supabase!.from("category_subcategories").select(SUB_COLUMNS).order("sort_order").order("id");
  if (!full.error) return full;
  return supabase!.from("category_subcategories").select(SUB_COLUMNS_LEGACY).order("sort_order").order("id");
}

export async function loadCategoryTree(): Promise<CategoryTree> {
  if (!isSupabaseConfigured || !supabase) {
    return { groups: DEFAULT_CATEGORY_GROUPS, source: "default", reason: "no-database" };
  }

  const [groupsRes, subsRes] = await Promise.all([
    supabase.from("category_groups").select("id, label, sort_order").order("sort_order").order("id"),
    selectSubcategories(),
  ]);

  // Either table missing means the migration has not run; a half-created tree
  // is not worth rendering, so fall back as a whole. Any other error — an
  // outage, a timeout — falls back too, but says so: it is not the same as
  // the tables being absent.
  const readError = groupsRes.error ?? subsRes.error;
  if (readError) {
    if (isTableMissing(readError)) {
      return { groups: DEFAULT_CATEGORY_GROUPS, source: "default", reason: "tables-missing" };
    }
    console.error("[category-tree] read failed:", readError.message);
    return { groups: DEFAULT_CATEGORY_GROUPS, source: "default", reason: "read-failed", detail: readError.message };
  }

  const groupRows = (groupsRes.data ?? []) as GroupRow[];
  // An empty table is a tree an admin emptied out, not a broken one — but a
  // storefront with no filters at all is never what they meant, so the default
  // stays visible. The admin editor is told the truth (`/api/categories`).
  if (groupRows.length === 0) {
    return { groups: DEFAULT_CATEGORY_GROUPS, source: "default", reason: "tables-empty" };
  }

  const subRows = (subsRes.data ?? []) as SubRow[];
  const groups: CategoryGroup[] = groupRows.map((g) => ({
    id: g.id,
    label: g.label,
    items: subRows
      .filter((s) => s.group_id === g.id)
      .map((s) => ({
        id: s.id,
        label: s.label,
        value: s.value,
        ...(s.size_type ? { sizeType: s.size_type as CategoryItem["sizeType"] } : {}),
        ...(s.sizes?.length ? { sizes: s.sizes } : {}),
      })),
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
