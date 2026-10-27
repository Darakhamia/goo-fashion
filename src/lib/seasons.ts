/**
 * The seasons an outfit is for, in one place.
 *
 * An outfit carried one season ("all", or one of four), set only in the old
 * studio dialog and read nowhere: no filter used it, the builder never asked.
 * By the CEO's decision of 2026-10-27 an outfit takes several — a light jacket
 * look is for spring and autumn both — and the builder, My looks and the
 * studio all set them (migration 030 adds `seasons`).
 *
 * No season at all means every season. That is what a look saved without
 * choosing one is, and what the old "all" was; all four chosen means the same
 * and is stored the same way, so "for every season" has one spelling.
 */
import type { Season } from "@/lib/types";

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const satisfies readonly Season[];

/** Mutable copy, for `.map()` call sites. */
export const SEASON_LIST: Season[] = [...SEASONS];

/** Older spellings a stored or linked season may use. */
const ALIASES: Record<string, Season> = { fall: "autumn" };

function asSeason(value: unknown): Season | null {
  const s = String(value ?? "").trim().toLowerCase();
  const season = ALIASES[s] ?? s;
  return (SEASONS as readonly string[]).includes(season) ? (season as Season) : null;
}

/**
 * The seasons in `values`, deduplicated and in calendar order; "all", an
 * unknown word and all four together each come out as none — every season.
 * Takes a list or a comma-separated string, so a `?season=` link and the old
 * single `season` column read through the same door.
 */
export function normalizeSeasons(values: unknown): Season[] {
  const list = Array.isArray(values) ? values : String(values ?? "").split(",");
  const wanted = new Set(list.map(asSeason).filter((s): s is Season => s !== null));
  const seasons = SEASON_LIST.filter((s) => wanted.has(s));
  return seasons.length === SEASONS.length ? [] : seasons;
}

/**
 * A row's seasons: the `seasons` list when the database has that column, the
 * old single `season` otherwise — a database a migration behind still shows
 * the season an outfit was given.
 */
export function seasonsFromRow(row: { seasons?: unknown; season?: unknown }): Season[] {
  return Array.isArray(row.seasons) ? normalizeSeasons(row.seasons) : normalizeSeasons(row.season);
}

/**
 * What the old single `season` column gets alongside the list, for readers of
 * a database where `seasons` never arrived: the one season, or "all".
 */
export function legacySeason(seasons: readonly Season[]): string {
  return seasons.length === 1 ? seasons[0] : "all";
}

/** A season as a shopper reads it: "autumn" → "Autumn". */
export function seasonLabel(season: Season): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

/** An outfit's seasons in one phrase: "All seasons", or "Spring, Autumn". */
export function seasonsLabel(seasons: readonly Season[]): string {
  return seasons.length ? seasons.map(seasonLabel).join(", ") : "All seasons";
}

/**
 * Seasons inside a sentence, lower case: "autumn", "spring and autumn",
 * "spring, summer and autumn". Nothing for every season — "Shop this look",
 * not "Shop this all-season look".
 */
export function seasonsPhrase(seasons: readonly Season[]): string {
  if (seasons.length <= 1) return seasons[0] ?? "";
  return `${seasons.slice(0, -1).join(", ")} and ${seasons[seasons.length - 1]}`;
}

/**
 * Does an outfit belong under the seasons a shopper picked? Any one of them is
 * enough, and an outfit for every season belongs under each — unlike styles,
 * where an untagged piece answers to none, "no season" here is a choice.
 */
export function matchesSeasons(outfitSeasons: readonly Season[] | undefined, chosen: readonly Season[]): boolean {
  if (!chosen.length || !outfitSeasons?.length) return true;
  return outfitSeasons.some((s) => chosen.includes(s));
}

/** Seasons named in a `?season=` link: one or several, comma-separated. */
export function seasonsFromParam(value: string | null): Season[] {
  return normalizeSeasons(value ?? "");
}
