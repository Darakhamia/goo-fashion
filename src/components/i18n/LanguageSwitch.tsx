"use client";

import { useLocale } from "@/lib/context/locale-context";
import type { Locale } from "@/lib/i18n/locale";

const OPTIONS: { id: Locale; label: string; name: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "uk", label: "UA", name: "Українська" },
];

/**
 * EN / UA toggle — the segmented control of DESIGN_SYSTEM.md §5.8, without the
 * sliding pill: the footer and the profile can show it at the same time.
 * `touch` makes each option a 44px target for phone layouts (§12).
 */
export default function LanguageSwitch({ touch = false, className = "" }: { touch?: boolean; className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div
      role="group"
      aria-label="Language / Мова"
      className={`flex gap-0 bg-[var(--surface)] rounded-full p-1 border border-[var(--border)] w-fit ${className}`}
    >
      {OPTIONS.map((o) => {
        const active = locale === o.id;
        return (
          <button
            key={o.id}
            type="button"
            lang={o.id}
            aria-pressed={active}
            aria-label={o.name}
            onClick={() => setLocale(o.id)}
            className={`shrink-0 rounded-full font-medium uppercase transition-colors duration-200 ${
              touch ? "min-h-11 px-5 text-[12px] tracking-[0.14em]" : "px-4 py-1.5 text-[10px] tracking-[0.16em]"
            } ${
              active
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
