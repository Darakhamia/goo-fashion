/**
 * Picking one colour out of a product's colour filters.
 *
 * A product carries a set of colour groups, because a black-and-silver sneaker
 * genuinely belongs in more than one colour filter. Anywhere that has room for
 * exactly one colour — a breadcrumb, a chip, a summary line — has to choose,
 * and the choice cannot be "the first id in the array": that order comes from
 * whatever sequence an admin happened to tick the boxes in, so the same product
 * would label itself differently after a re-save.
 */
import type { ColorGroup } from "@/lib/types";

/** The group name that outranks every other, matched case-insensitively. */
export const MULTICOLOR = "multicolor";

/**
 * The one colour group that best represents a product.
 *
 * Multicolor wins whenever it is one of the product's groups. That is not an
 * arbitrary precedence: a piece filed under several colours *is* multicoloured,
 * and naming any single one of them — "White" for a white/black/silver trainer —
 * says something false about it. Multicolor is the only label that stays true.
 *
 * Failing that, the groups' own display order decides, so the answer matches the
 * order they appear in the filter sidebar. `sortOrder` can be edited in the
 * admin, hence the id tie-break: two groups sharing a position must still
 * resolve the same way on every render.
 *
 * Returns undefined when the product has no colour filter, or carries only ids
 * that no longer name a group — a group deleted in the admin leaves those
 * behind, and inventing a colour for them would be worse than showing none.
 */
export function primaryColorGroup(
  colorGroupIds: number[] | null | undefined,
  groups: ColorGroup[],
): ColorGroup | undefined {
  const ids = new Set(colorGroupIds ?? []);
  if (!ids.size) return undefined;

  const mine = groups.filter((g) => ids.has(g.id));
  if (!mine.length) return undefined;

  const multi = mine.find((g) => g.name.trim().toLowerCase() === MULTICOLOR);
  if (multi) return multi;

  return [...mine].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)[0];
}
