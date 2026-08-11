/**
 * The Journal's category taxonomy — one source of truth.
 *
 * The list used to exist twice: as `COMMON_CATEGORIES` in the admin page and
 * again, hardcoded, inside the post-generation prompt. They were already
 * drifting, and a category the generator can emit but the admin does not offer
 * (or the other way round) shows up as a one-off tag nothing can filter by.
 *
 * Two groups, because the Journal carries two kinds of writing: fashion
 * editorial, and product/company news aimed at customers. The groups do not
 * split the page — posts share one feed and one filter — but they decide which
 * categories each generation mode is allowed to pick from.
 *
 * `category` on `blog_posts` is free text, so older posts may carry values that
 * are no longer on this list. Nothing here assumes otherwise: the filter derives
 * its chips from the posts that actually exist and ranks known categories first.
 */

export type BlogCategoryGroup = "editorial" | "product";

export type BlogCategory = {
  name: string;
  group: BlogCategoryGroup;
  /** One line on what belongs here — shown in the admin, not on the public page. */
  blurb: string;
};

export const BLOG_CATEGORIES: readonly BlogCategory[] = [
  // ── Editorial ────────────────────────────────────────────────────────────
  { name: "Trends", group: "editorial", blurb: "What is moving in fashion right now." },
  {
    name: "Style Guide",
    group: "editorial",
    blurb: "How to wear and combine it. Absorbs the old How-to.",
  },
  { name: "Brands", group: "editorial", blurb: "A single label, read closely." },
  {
    name: "Smart Shopping",
    group: "editorial",
    blurb: "Price, quality, resale — what is worth the money.",
  },

  // ── Product & company ────────────────────────────────────────────────────
  {
    name: "Product Updates",
    group: "product",
    blurb: "Releases on the site: what shipped and what changed.",
  },
  {
    name: "AI Stylist",
    group: "product",
    blurb: "The stylist itself — what it can do, what got better.",
  },
  {
    name: "Announcements",
    group: "product",
    blurb: "Plans, pricing, policy — anything a customer has to know.",
  },
] as const;

export const BLOG_CATEGORY_NAMES: readonly string[] = BLOG_CATEGORIES.map((c) => c.name);

export const EDITORIAL_CATEGORY_NAMES: readonly string[] = BLOG_CATEGORIES.filter(
  (c) => c.group === "editorial"
).map((c) => c.name);

export const PRODUCT_CATEGORY_NAMES: readonly string[] = BLOG_CATEGORIES.filter(
  (c) => c.group === "product"
).map((c) => c.name);

/**
 * Sort key for a category coming out of the database: known categories keep the
 * order declared above, anything left over from an earlier taxonomy sorts after
 * them instead of disappearing.
 */
export function blogCategoryRank(name: string): number {
  const i = BLOG_CATEGORY_NAMES.indexOf(name);
  return i === -1 ? BLOG_CATEGORY_NAMES.length : i;
}

export function blogCategoryGroup(name: string): BlogCategoryGroup | null {
  return BLOG_CATEGORIES.find((c) => c.name === name)?.group ?? null;
}
