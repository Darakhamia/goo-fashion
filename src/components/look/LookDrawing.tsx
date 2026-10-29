"use client";

import { generationStyleLabel, type GenerationStyle } from "@/lib/look-generation";

/**
 * "The photo is being drawn", laid over the picture it will replace.
 *
 * The Builder used to cover the whole screen with a card of its own while a
 * photo was drawn, and My looks showed nothing at all — "Regenerating…" in a
 * menu that had usually been closed by then (CEO, 2026-10-29). Both now put
 * this over the picture itself: the old photo or collage stays underneath,
 * dimmed, so it is clear what is being replaced, and the new one takes its
 * place when it arrives. It fills its parent, which must be positioned.
 *
 * `compact` is for a small picture — a card in the grid, a thumbnail in the
 * phone's save sheet: the sweep and the bar, no words.
 */
export function LookDrawing({ style, compact = false }: { style?: GenerationStyle | null; compact?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Drawing the photo${style ? `: ${generationStyleLabel(style)}` : ""}`}
      className="absolute inset-0 z-20 overflow-hidden bg-[var(--bg-overlay-90)] backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 animate-fade-in"
    >
      {/* Indeterminate bar along the top edge. */}
      <div aria-hidden="true" className="absolute top-0 inset-x-0 h-[2px] bg-[var(--fg-overlay-08)] overflow-hidden">
        <div className="absolute inset-y-0 w-1/2 bg-[var(--foreground)] origin-left animate-progress-bar" />
      </div>
      {/* A light sweeping across the picture. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--fg-overlay-08)] to-transparent animate-shimmer pointer-events-none"
      />
      <div aria-hidden="true" className="relative flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full bg-[var(--foreground)]"
            style={{ animation: `dot-bounce 1.2s ease-in-out ${i * 0.18}s infinite` }}
          />
        ))}
      </div>
      {!compact && (
        <div className="relative text-center px-6">
          <p className="text-[14px] md:text-[12px] font-semibold md:font-medium md:uppercase md:tracking-[0.14em] text-[var(--foreground)]">
            Drawing your look…
          </p>
          <p className="mt-1 text-[12px] md:text-[11px] text-[var(--foreground-muted)]">
            {style ? `${generationStyleLabel(style)} · ` : ""}10–30 seconds
          </p>
        </div>
      )}
    </div>
  );
}
