/**
 * A bound on how long a build is allowed to wait for the database.
 *
 * `sitemap.ts` and `sitemap-page` are prerendered, so their three catalogue
 * reads run during `next build`, on the deploy builder. Both already guarded
 * against the database *failing* — `.catch(() => [])` — but nothing guarded
 * against it going quiet. `@supabase/supabase-js` fetches with no timeout, so a
 * builder that cannot reach the database (a firewall between the build network
 * and the database container, a container mid-restart) does not error: it waits.
 * The build waits with it until the platform's own limit kills the deploy,
 * which surfaces as a failure with no error in it — the hardest kind to read.
 *
 * A missing sitemap entry is recoverable and a failed deploy is not, so the
 * trade is one-sided: give up on the data, log loudly, ship the build. Both
 * pages carry `revalidate = 3600`, so a build that came up short regenerates
 * within the hour anyway.
 */

/** Generous for a healthy paged read, far below any platform build timeout. */
export const BUILD_DATA_TIMEOUT_MS = 30_000;

/**
 * `work`, or `fallback` if it takes longer than `ms` or rejects.
 *
 * Never rejects, so a caller can use it in a `Promise.all` without a `.catch`
 * of its own. The abandoned work is left to finish or not — nothing reads it
 * either way, and its rejection is absorbed here so it cannot resurface later
 * as an unhandled rejection and take the process down after the fact.
 */
export function withTimeout<T>(
  work: Promise<T>,
  fallback: T,
  label: string,
  ms: number = BUILD_DATA_TIMEOUT_MS,
): Promise<T> {
  const safe = work.catch((e: unknown) => {
    console.warn(`[${label}] failed, continuing without it:`, e instanceof Error ? e.message : e);
    return fallback;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      // Loud on purpose. A silently shortened sitemap is a regression someone
      // should be able to find in the build log rather than in search results.
      console.warn(`[${label}] still waiting after ${ms}ms — continuing without it`);
      resolve(fallback);
    }, ms);
  });

  return Promise.race([safe, guard]).finally(() => clearTimeout(timer));
}
