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
