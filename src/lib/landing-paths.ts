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
