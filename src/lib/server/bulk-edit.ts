/**
 * The value transformations a bulk edit performs, kept apart from the route
 * that serves it so they can be exercised on their own.
 */

/**
 * A product's new name.
 *
 * Find-and-replace runs BEFORE the prefix and suffix are added, so a prefix is
 * never itself searched and mangled: adding "SS26 " while replacing "SS26" with
 * "SS25" has to leave the new prefix alone.
 *
 * Whitespace is collapsed at the end because deleting a word out of the middle
 * of a name otherwise leaves a double space behind — "Wool  Coat" — which is
 * invisible in the admin and obvious on the storefront.
 */
export function nextName(
  current: string,
  edit: { prefix?: string; suffix?: string; find?: string; replace?: string },
): string {
  let next = current ?? "";
  if (edit.find) next = next.split(edit.find).join(edit.replace ?? "");
  if (edit.prefix) next = `${edit.prefix}${next}`;
  if (edit.suffix) next = `${next}${edit.suffix}`;
  return next.trim().replace(/\s+/g, " ");
}

/** Appended without duplicates, so adding to a piece keeps what it had. */
export function mergeUnique<T>(existing: T[] | null | undefined, added: T[]): T[] {
  return [...new Set([...(existing ?? []), ...added])];
}

/**
 * How many products' previous values one audit entry keeps. The entry is a
 * single jsonb row the Activity page loads with its neighbours; past this the
 * entry still says how many there were.
 */
export const AUDIT_PREVIOUS_CAP = 1000;

/**
 * What `columns` held on each product before a bulk write, for its audit
 * entry. Without it a mistaken "set brand" across a selection could not be
 * put back: the log said what was written, not what it replaced.
 */
export function previousValues(
  rows: ReadonlyArray<{ id: string } & Record<string, unknown>>,
  columns: readonly string[],
): { id: string; before: Record<string, unknown> }[] {
  return rows.slice(0, AUDIT_PREVIOUS_CAP).map((row) => ({
    id: row.id,
    before: Object.fromEntries(columns.map((c) => [c, row[c] ?? null])),
  }));
}
