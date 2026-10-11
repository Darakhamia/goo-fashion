/**
 * Addresses of the catalogue's landing pages — one per brand, category group
 * and subcategory (docs/SEO_PLAN.md, SEO-17). Plain functions with no imports,
 * so a client component (a product page's breadcrumbs) and the server pages
 * that answer these addresses build them the same way.
 */

/**
 * A name as a URL segment: lowercase ASCII words joined by hyphens.
 * "Enfants Riches Déprimés" → "enfants-riches-deprimes",
 * "Hoodies & Sweatshirts" → "hoodies-and-sweatshirts".
 */
export function landingSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** /brands/timberland */
export function brandPath(brand: string): string {
  return `/brands/${landingSlug(brand)}`;
}

/** /c/footwear — a category group, by its id in the category tree. */
export function categoryPath(groupId: string): string {
  return `/c/${encodeURIComponent(groupId)}`;
}

/** /c/footwear/boots — a subcategory, under its group. */
export function subcategoryPath(groupId: string, label: string): string {
  return `${categoryPath(groupId)}/${landingSlug(label)}`;
}

/**
 * Brands that are a line of another brand in the catalogue: line slug → the
 * parent's slug and name. A line keeps its own page; the parent's page lists
 * the line's products too, because to a shopper "adidas Originals" is still
 * adidas (CEO, 2026-10-11).
 */
export const BRAND_LINES: Record<string, { parent: string; parentName: string }> = {
  "adidas-originals": { parent: "adidas", parentName: "adidas" },
};

/** The parent brand's slug of a line, or undefined for a brand of its own. */
export function parentBrandSlug(brand: string): string | undefined {
  return BRAND_LINES[landingSlug(brand)]?.parent;
}

/** /brands/timberland/boots — one brand's pieces of one subcategory. */
export function brandSubcategoryPath(brand: string, label: string): string {
  return `${brandPath(brand)}/${landingSlug(label)}`;
}
