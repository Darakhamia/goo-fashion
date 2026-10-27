"use client";

import type { Season } from "@/lib/types";
import { SEASON_LIST, normalizeSeasons, seasonLabel } from "@/lib/seasons";

/**
 * The seasons a look is for, as chips: "All seasons" and the four. Any number
 * may be picked; "All seasons" — none picked — clears them, and picking all
 * four reads as "All seasons" too (lib/seasons). The builder's save dialogs and
 * the My looks editor share it, so a look is described the same way wherever
 * it is saved; the chips are the style chips' recipe beside them.
 */
export function SeasonPicker({
  value,
  onChange,
  className = "",
}: {
  value: readonly Season[];
  onChange: (next: Season[]) => void;
  className?: string;
}) {
  const chip = (on: boolean) =>
    `h-9 md:h-auto px-3.5 md:px-4 md:py-2 rounded-full md:border text-[13px] md:text-[11px] md:tracking-[0.12em] md:uppercase md:font-medium transition-colors duration-200 ${
      on
        ? "md:border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] max-md:font-semibold"
        : "bg-[var(--fg-overlay-08)] md:bg-transparent md:border-[var(--border-strong)] text-[var(--foreground)] md:text-[var(--foreground-muted)] md:hover:border-[var(--foreground)] md:hover:text-[var(--foreground)]"
    }`;
  return (
    <div role="group" aria-label="Seasons" className={`flex flex-wrap gap-2 md:gap-1.5 ${className}`}>
      <button type="button" aria-pressed={value.length === 0} onClick={() => onChange([])} className={chip(value.length === 0)}>
        All seasons
      </button>
      {SEASON_LIST.map((season) => {
        const on = value.includes(season);
        return (
          <button
            key={season}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(normalizeSeasons(on ? value.filter((s) => s !== season) : [...value, season]))}
            className={chip(on)}
          >
            {seasonLabel(season)}
          </button>
        );
      })}
    </div>
  );
}
