/**
 * The catalog's two-level category tree, shared by the browse filters and by
 * the breadcrumbs on the product page.
 *
 * A product stores one `category` value. That value sits inside a group, so a
 * pair of "Bottoms / Jeans" can be derived from it without any extra field.
 * Several labels can share a value — Sneakers, Sandals and Boots are all
 * `footwear` — which is why a value only resolves to a specific label when
 * exactly one label claims it.
 */

export interface CategoryItem {
  label: string;
  value: string;
}

export interface CategoryGroup {
  id: string;
  label: string;
  items: CategoryItem[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
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
export const SUBCATEGORY_TO_VALUE: Record<string, string> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((g) => g.items.map((i) => [i.label, i.value])),
);

/** The group a stored category value belongs to. */
export function groupForCategory(category: string): CategoryGroup | undefined {
  return CATEGORY_GROUPS.find((g) => g.items.some((i) => i.value === category));
}

/**
 * The subcategory label for a stored value, but only when it is unambiguous.
 *
 * `blazers` is only ever "Blazers", so it resolves. `footwear` is claimed by
 * Sneakers, Sandals and Boots alike, so the product itself cannot say which —
 * distinguishing those needs a subcategory field on the product, which the
 * schema does not have.
 */
export function subcategoryForCategory(category: string): string | undefined {
  const labels = CATEGORY_GROUPS.flatMap((g) => g.items)
    .filter((i) => i.value === category)
    .map((i) => i.label);
  return labels.length === 1 ? labels[0] : undefined;
}
