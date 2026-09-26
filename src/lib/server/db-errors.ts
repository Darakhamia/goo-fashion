/**
 * Reading a failed Supabase query: is it "the table isn't there yet"?
 *
 * Several features ship their table in a migration that a database may not have
 * run. Each of them treats that case as "nothing stored yet" or answers with a
 * message naming the migration, instead of a raw database error.
 */

interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

/**
 * The table isn't there yet. Postgres says 42P01 (undefined_table); PostgREST,
 * which answers from its own schema cache, says PGRST205 — and its message
 * ("could not find the table … in the schema cache") tells an admin nothing
 * about what to do.
 */
export const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

/**
 * The table a query named does not exist — decided by the error code alone.
 *
 * Use this where a missing column, function or schema must not read as a
 * missing table: a caller that names the migration to run, or one that tells
 * the two apart.
 */
export function isMissingTable(error: DbErrorLike | null | undefined): boolean {
  return !!error?.code && MISSING_TABLE_CODES.has(error.code);
}

/**
 * Looser: the codes above, or any error whose message says "does not exist".
 *
 * That also takes in a missing column ("column … does not exist", 42703), a
 * missing function or schema. Right for a caller that reads every such error as
 * "this optional feature's migration has not run"; wrong for one that has to
 * tell them apart — use `isMissingTable` there.
 */
export function isMissingTableLoose(error: DbErrorLike | null | undefined): boolean {
  return !!error && (isMissingTable(error) || !!error.message?.includes("does not exist"));
}
