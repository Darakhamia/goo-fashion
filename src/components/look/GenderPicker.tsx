"use client";

import type { Gender } from "@/lib/types";
import { GENDERS, genderLabel } from "@/lib/outfit-gender";

/**
 * Who a look is for, as chips: Women, Men, Unisex — one of them. The builder's
 * save dialogs and the My looks editor share it, next to the seasons; it
 * starts on what the pieces add up to (lib/outfit-gender), so most people
 * never have to touch it. The chips are the style chips' recipe beside them.
 */
export function GenderPicker({
  value,
  onChange,
  className = "",
}: {
  value: Gender;
  onChange: (next: Gender) => void;
  className?: string;
}) {
  const chip = (on: boolean) =>
    `h-9 md:h-auto px-3.5 md:px-4 md:py-2 rounded-full md:border text-[13px] md:text-[11px] md:tracking-[0.12em] md:uppercase md:font-medium transition-colors duration-200 ${
      on
        ? "md:border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] max-md:font-semibold"
        : "bg-[var(--fg-overlay-08)] md:bg-transparent md:border-[var(--border-strong)] text-[var(--foreground)] md:text-[var(--foreground-muted)] md:hover:border-[var(--foreground)] md:hover:text-[var(--foreground)]"
    }`;
  return (
    <div role="radiogroup" aria-label="Who it is for" className={`flex flex-wrap gap-2 md:gap-1.5 ${className}`}>
      {GENDERS.map((g) => (
        <button key={g} type="button" role="radio" aria-checked={value === g} onClick={() => onChange(g)} className={chip(value === g)}>
          {genderLabel(g)}
        </button>
      ))}
    </div>
  );
}
