"use client";

import { useId, useState } from "react";
import type { Gender, Season, StyleKeyword } from "@/lib/types";
import { STYLE_KEYWORD_LIST as STYLE_KEYWORDS } from "@/lib/style-keywords";
import { GenderPicker } from "@/components/look/GenderPicker";
import { SeasonPicker } from "@/components/look/SeasonPicker";

/** What a shopper says about a look: the words, and what it is filtered by. */
export interface LookDetails {
  name: string;
  description: string;
  styleKeywords: string[];
  seasons: Season[];
  gender: Gender;
}

/**
 * The fields of a look's details — name (with Suggest), description, styles,
 * seasons and who it is for.
 *
 * One set for both places a look is described: My looks → Edit info, and the
 * Builder's Save look. Saving offered a name, seasons and "For" only, so a
 * description or styles meant saving first and editing after (CEO,
 * 2026-10-29); now both show the same fields, in the same order. Suggest asks
 * the studio's copywriter, not a template (CEO, 2026-10-31).
 */
export function LookDetailsFields({
  value,
  onChange,
  onSuggest,
  namePlaceholder,
  onSubmit,
  autoFocusName = false,
}: {
  value: LookDetails;
  onChange: (next: LookDetails) => void;
  /**
   * Fill the name and description from the site's copywriter
   * (lib/suggest-look-copy). Resolves to why it could not, or null once the
   * fields are set.
   */
  onSuggest?: () => Promise<string | null>;
  namePlaceholder?: string;
  /** Enter in the name field. */
  onSubmit?: () => void;
  autoFocusName?: boolean;
}) {
  // Both the Builder's desktop window and its phone sheet are mounted at once.
  const uid = useId();
  // Suggest is a model call: a second or two, and it can fail.
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const suggest = async () => {
    if (!onSuggest || suggesting) return;
    setSuggesting(true);
    setSuggestError(null);
    setSuggestError(await onSuggest());
    setSuggesting(false);
  };
  const set = (patch: Partial<LookDetails>) => onChange({ ...value, ...patch });
  const toggleStyle = (kw: StyleKeyword) =>
    set({
      styleKeywords: value.styleKeywords.includes(kw)
        ? value.styleKeywords.filter((k) => k !== kw)
        : [...value.styleKeywords, kw],
    });
  const label = "block text-[13px] md:text-[10px] md:uppercase md:tracking-[0.14em] text-[var(--foreground-muted)]";
  const field =
    "w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-base md:text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--border-strong)] transition-colors mb-5";

  return (
    <>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={`${uid}-name`} className={label}>
          Name
        </label>
        {onSuggest && (
          <button
            type="button"
            onClick={() => void suggest()}
            disabled={suggesting}
            aria-busy={suggesting}
            className="max-md:-mr-3 max-md:h-11 max-md:px-3 inline-flex items-center gap-1.5 text-[14px] md:text-[10px] md:uppercase md:tracking-[0.12em] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-60 transition-colors"
            title="Write a name and description for this look in GOO's house style"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true" className={suggesting ? "animate-pulse" : ""}>
              <path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6Z" />
            </svg>
            {suggesting ? "Writing…" : "Suggest"}
          </button>
        )}
      </div>
      {suggestError && (
        <p role="alert" className="-mt-0.5 mb-1.5 text-[13px] md:text-[11px] text-red-500">
          {suggestError}
        </p>
      )}
      <input
        id={`${uid}-name`}
        type="text"
        value={value.name}
        onChange={(e) => set({ name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={namePlaceholder}
        maxLength={120}
        autoFocus={autoFocusName}
        className={field}
      />

      <label htmlFor={`${uid}-description`} className={`${label} mb-1.5`}>
        Description
      </label>
      <textarea
        id={`${uid}-description`}
        value={value.description}
        onChange={(e) => set({ description: e.target.value })}
        placeholder="What makes this look work?"
        rows={3}
        maxLength={2000}
        className={`${field} resize-none`}
      />

      <p className={`${label} mb-2.5 md:mb-1.5`}>Styles</p>
      <div className="flex flex-wrap gap-2 md:gap-1.5 mb-6">
        {STYLE_KEYWORDS.map((kw) => {
          const on = value.styleKeywords.includes(kw);
          return (
            <button
              key={kw}
              type="button"
              onClick={() => toggleStyle(kw)}
              aria-pressed={on}
              className={`h-9 md:h-auto px-3.5 md:px-4 md:py-2 rounded-full md:border text-[13px] md:text-[11px] md:tracking-[0.12em] capitalize md:uppercase md:font-medium transition-colors duration-200 ${
                on
                  ? "md:border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] max-md:font-semibold"
                  : "bg-[var(--fg-overlay-08)] md:bg-transparent md:border-[var(--border-strong)] text-[var(--foreground)] md:text-[var(--foreground-muted)] md:hover:border-[var(--foreground)] md:hover:text-[var(--foreground)]"
              }`}
            >
              {kw}
            </button>
          );
        })}
      </div>

      <p className={`${label} mb-2.5 md:mb-1.5`}>Seasons</p>
      <SeasonPicker value={value.seasons} onChange={(seasons) => set({ seasons })} className="mb-5" />

      <p className={`${label} mb-2.5 md:mb-1.5`}>For</p>
      <GenderPicker value={value.gender} onChange={(gender) => set({ gender })} className="mb-6" />
    </>
  );
}
