/**
 * Writing a row to a database that may be a migration behind the code.
 *
 * This project deploys the app and runs its migrations as separate steps, so
 * there is always a window where a column exists in the code and not yet in the
 * database. PostgREST answers a write naming an unknown column with PGRST204 and
 * the column's name in the message, which is enough to drop that one field and
 * try again — the row lands without it instead of the request failing.
 *
 * The important part is the allow-list. Only columns the caller nominates as
 * optional are ever dropped: anything else failing is a real error and is
 * returned as one. A version of this that dropped whatever the message named
 * would quietly write half a row when something genuinely went wrong.
 */

export interface WriteError {
  code?: string;
  message: string;
}

/** PostgREST's code for "the payload names a column I don't know about". */
export const UNKNOWN_COLUMN = "PGRST204";

export async function writeRowDroppingUnknown<T>(
  row: Record<string, unknown>,
  optionalColumns: readonly string[],
  // Supabase query builders are thenable rather than real Promises.
  write: (row: Record<string, unknown>) => PromiseLike<{ data: T | null; error: WriteError | null }>,
): Promise<{ data: T | null; error: WriteError | null; dropped: string[] }> {
  const payload = { ...row };
  const dropped: string[] = [];

  for (;;) {
    const { data, error } = await write(payload);
    if (!error) return { data, error: null, dropped };

    const missing =
      error.code === UNKNOWN_COLUMN
        ? optionalColumns.find((c) => c in payload && error.message.includes(`'${c}'`))
        : undefined;
    if (!missing) return { data, error, dropped };

    delete payload[missing];
    dropped.push(missing);
  }
}
