/**
 * The catalog's two-level category tree, shared by the browse filters, the
 * outfit builder, the admin product editor and the breadcrumbs on a product
 * page.
 *
 * A product stores two values. `category` is the fixed bucket the rest of the
 * code filters and classifies on; several labels can share one — Sneakers,
 * Sandals and Boots are all `footwear`. `subcategory` is the label naming
 * which of them a piece actually is, and it only resolves when the tree still
 * claims that label for that category.
 *
 * The tree itself lives in the database (`category_groups` /
 * `category_subcategories`, migration 011) and is edited in the admin panel
 * under Categories. Everything below is the built-in default: the tree as it
 * was hardcoded. It is what renders when the migration has not run, when the
 * database is unreachable, and on the client's first paint before
 * `/api/categories` answers — so the functions here take the live tree as an
 * argument and fall back to the default when given none.
 */
import type { Category } from "@/lib/types";

export interface CategoryItem {
  label: string;
  value: string;
  /**
   * The `category_subcategories` row this came from. Present only on a tree
   * loaded from the database — the admin editor needs it to address a row,
   * and its absence is what marks the built-in default as read-only.
   */
  id?: number;
}

export interface CategoryGroup {
  id: string;
  label: string;
  items: CategoryItem[];
}

/**
 * Every category value a product may store.
 *
 * The admin panel offers these when pointing a subcategory at a bucket, so
 * the list has to stay in step with the `Category` union in types.ts — the
 * `satisfies` clause is what makes a drift there a compile error here.
 */
export const CATEGORY_VALUES = [
  "outerwear", "tops", "shirts", "knitwear", "blazers",
  "bottoms", "jeans", "shorts", "skirts",
  "dresses", "jumpsuits",
  "footwear", "bags", "accessories", "swimwear",
] as const satisfies readonly Category[];

export const DEFAULT_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: "outerwear",
    label: "Outerwear",
    items: [
      { label: "Jackets", value: "outerwear" },
      { label: "Coats", value: "outerwear" },
      { label: "Parkas", value: "outerwear" },
      { label: "Vests", value: "outerwear" },
      { label: "Bomber Jackets", value: "outerwear" },
      { label: "Raincoats", value: "outerwear" },
      { label: "Blazers", value: "blazers" },
    ],
  },
  {
    id: "tops",
    label: "Tops",
    items: [
      { label: "T-Shirts", value: "tops" },
      { label: "Hoodies & Sweatshirts", value: "tops" },
      { label: "Shirts", value: "shirts" },
      { label: "Knitwear", value: "knitwear" },
    ],
  },
  {
    id: "bottoms",
    label: "Bottoms",
    items: [
      { label: "Pants", value: "bottoms" },
      { label: "Jeans", value: "jeans" },
      { label: "Shorts", value: "shorts" },
      { label: "Skirts", value: "skirts" },
    ],
  },
  {
    id: "dresses",
    label: "Dresses",
    items: [
      { label: "Dresses", value: "dresses" },
      { label: "Jumpsuits", value: "jumpsuits" },
    ],
  },
  {
    id: "footwear",
    label: "Footwear",
    items: [
      { label: "Sneakers", value: "footwear" },
      { label: "Sandals", value: "footwear" },
      { label: "Boots", value: "footwear" },
    ],
  },
  {
    id: "accessories",
    label: "Accessories",
    items: [
      { label: "Bags", value: "bags" },
      { label: "Hats", value: "accessories" },
      { label: "Belts", value: "accessories" },
      { label: "Sunglasses", value: "accessories" },
      { label: "Watches", value: "accessories" },
    ],
  },
];

/** Subcategory label → the category value it filters on. */
export function subcategoryToValue(
  tree: CategoryGroup[] = DEFAULT_CATEGORY_GROUPS,
): Record<string, string> {
  return Object.fromEntries(tree.flatMap((g) => g.items.map((i) => [i.label, i.value])));
}

/** The group a stored category value belongs to. */
export function groupForCategory(
  category: string,
  tree: CategoryGroup[] = DEFAULT_CATEGORY_GROUPS,
): CategoryGroup | undefined {
  return tree.find((g) => g.items.some((i) => i.value === category));
}

/**
 * The group a product belongs to.
 *
 * Prefer its subcategory label, and only fall back to the category value. Two
 * groups may point at the same value — a "Sport" group whose Leggings are
 * stored as `bottoms` sits alongside the Bottoms group — and the value alone
 * cannot tell them apart, so resolving by it would always name whichever group
 * comes first and strand the other. Labels are unique across the whole tree
 * (the `category_subcategories` table enforces it), so one names its group
 * exactly.
 *
 * A piece with no subcategory yet genuinely could be in either, so the value's
 * first group is the right answer there.
 */
export function groupForProduct(
  category: string,
  subcategory: string | undefined,
  tree: CategoryGroup[] = DEFAULT_CATEGORY_GROUPS,
): CategoryGroup | undefined {
  if (subcategory) {
    const owner = tree.find((g) => g.items.some((i) => i.label === subcategory));
    if (owner) return owner;
  }
  return groupForCategory(category, tree);
}

/** Every subcategory label a stored category value can carry. */
export function subcategoriesForCategory(
  category: string,
  tree: CategoryGroup[] = DEFAULT_CATEGORY_GROUPS,
): string[] {
  return tree
    .flatMap((g) => g.items)
    .filter((i) => i.value === category)
    .map((i) => i.label);
}

/**
 * The subcategory label implied by a stored value, when only one claims it.
 *
 * `blazers` is only ever "Blazers", so it resolves. `footwear` is claimed by
 * Sneakers, Sandals and Boots alike, so the category alone cannot say which —
 * that is what a product's own `subcategory` records. This stays as the
 * fallback for rows saved before the field existed.
 */
export function subcategoryForCategory(
  category: string,
  tree: CategoryGroup[] = DEFAULT_CATEGORY_GROUPS,
): string | undefined {
  const labels = subcategoriesForCategory(category, tree);
  return labels.length === 1 ? labels[0] : undefined;
}

/**
 * The subcategory to show for a product: its own if the tree still claims it
 * for that category, otherwise the one its category implies. Returns undefined
 * when neither can name it.
 */
export function resolveSubcategory(
  category: string,
  subcategory?: string,
  tree: CategoryGroup[] = DEFAULT_CATEGORY_GROUPS,
): string | undefined {
  if (subcategory && subcategoriesForCategory(category, tree).includes(subcategory)) {
    return subcategory;
  }
  return subcategoryForCategory(category, tree);
}
