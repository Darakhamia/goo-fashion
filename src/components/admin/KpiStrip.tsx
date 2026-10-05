import type { CSSProperties, ReactNode } from "react";

/*
 * Key numbers in one panel (docs/ADMIN_DESIGN.md 5.6, GS4-12):
 *
 *   PRODUCTS          OUTFITS                CUSTOMERS
 *   1,224             27                     12
 *   +659 this month   19 AI-generated · 4…   +2 this month · team excluded
 *
 * Cells divided by hairlines, 4–6 of them: the service label, the number at
 * 28px light, one muted line under it with the change as a number ("+659 this
 * month"), not a coloured percentage pill. In one row from lg; below it a 2×N
 * grid, the last cell spanning both columns when the count is odd.
 */

export type Kpi = {
  key: string;
  label: ReactNode;
  /** "—" while unknown: a failed read is never shown as zero. */
  value: ReactNode;
  note?: ReactNode;
  /** A tooltip on the note: what the change compares. */
  noteTitle?: string;
};

export function KpiStrip({ label, items }: { label: string; items: Kpi[] }) {
  return (
    <section
      aria-label={label}
      // The hairlines are the panel's border colour showing through 1px gaps.
      className="grid grid-cols-2 lg:grid-cols-[repeat(var(--kpi-cols),minmax(0,1fr))] gap-px rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--border)]"
      style={{ "--kpi-cols": items.length } as CSSProperties}
    >
      {items.map((k) => (
        <div key={k.key} className="min-w-0 px-4 py-4 md:px-5 bg-[var(--surface)] max-lg:odd:last:col-span-2">
          <div className="text-[11px] leading-4 tracking-[0.12em] uppercase text-[var(--foreground-muted)] truncate">{k.label}</div>
          <div className="mt-1.5 font-display text-[24px] leading-7 md:text-[28px] md:leading-8 font-light tabular-nums text-[var(--foreground)]">
            {k.value}
          </div>
          {k.note && (
            <div className="mt-1 text-[12px] leading-[18px] text-[var(--foreground-muted)]" title={k.noteTitle}>
              {k.note}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
