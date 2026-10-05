"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useT } from "@/app/goo-studio/_i18n";

/*
 * The admin's one table (docs/ADMIN_DESIGN.md 5.8, GS4-4).
 *
 * - Rows 52px; the header is a 36px service label and sticks to the top of
 *   the page while it scrolls (from md: on a phone the table scrolls sideways
 *   in its own box instead).
 * - One column grows and truncates (`grow`); every other cell keeps to one
 *   line. Numbers go right (`align: "right"`, tabular figures).
 * - Row actions sit in the last column: shown on hover and on keyboard focus,
 *   always on touch screens, and pinned to the right edge on a phone.
 * - Pages of 50 with "1–50 of 412" under the table: the browser no longer
 *   draws all 1 224 products, and their photos, at once. `resetKey` sends the
 *   table back to the first page when the filters or the sort change.
 * - Selection is the caller's: a checkbox column when `selection` is given,
 *   Shift-click for a run of rows (the caller decides what a run is).
 */

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** The column that takes the free width and truncates its text. */
  grow?: boolean;
  /** Hidden below this breakpoint. */
  hide?: "sm" | "md" | "lg";
  sort?: { dir: "asc" | "desc" | null; onToggle: () => void };
};

export type Selection<T> = {
  selected: ReadonlySet<string>;
  /** `range`: Shift was held — select everything since the last row ticked. */
  onToggle: (id: string, range: boolean) => void;
  onToggleAll: () => void;
  /** All rows (not only this page) are selected. */
  allSelected: boolean;
  /** Names the row for its checkbox ("Select Athleticz oversized T-shirt"). */
  rowLabel: (row: T) => string;
};

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" } as const;

const TH =
  "h-9 text-left text-[11px] tracking-[0.12em] uppercase font-normal text-[var(--foreground-muted)] whitespace-nowrap bg-[var(--surface)] md:sticky md:top-0 md:z-10 border-b border-[var(--border)]";

function SortArrow({ dir }: { dir: "asc" | "desc" | null }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className={dir ? "opacity-100" : "opacity-0 group-hover/sort:opacity-50"}>
      <path
        d={dir === "asc" ? "M2.5 6.5L5 4l2.5 2.5" : "M2.5 4L5 6.5 7.5 4"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Horizontal padding by position: 16px at the table's edges, 12px between cells. */
function pad(first: boolean, last: boolean): string {
  return `${first ? "pl-4" : "pl-3"} ${last ? "pr-4" : "pr-3"}`;
}

/** Which page numbers to show: first, last, and the neighbours of the current one. */
function pageList(current: number, count: number): (number | "gap")[] {
  const keep = new Set([0, count - 1, current - 1, current, current + 1].filter((p) => p >= 0 && p < count));
  const out: (number | "gap")[] = [];
  let prev = -1;
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (prev >= 0 && p - prev > 1) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}

export function DataTable<T>({
  label,
  rows,
  rowKey,
  columns,
  selection,
  actions,
  loading = false,
  empty,
  pageSize = 50,
  resetKey = "",
}: {
  /** Names the table for screen readers. */
  label: string;
  rows: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  selection?: Selection<T>;
  /** Row actions, usually an icon button and a RowMenu. */
  actions?: (row: T) => ReactNode;
  loading?: boolean;
  /** Shown when there are no rows: an EmptyState, or a load error with Retry. */
  empty?: ReactNode;
  pageSize?: number;
  resetKey?: string;
}) {
  const t = useT();
  const topRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setPage(0);
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const shown = rows.slice(start, start + pageSize);
  const paged = rows.length > pageSize;
  const colCount = columns.length + (selection ? 1 : 0) + (actions ? 1 : 0);

  const go = (p: number) => {
    setPage(p);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div
      ref={topRef}
      className="scroll-mt-4 rounded-xl border border-[var(--border)] overflow-x-auto md:overflow-visible"
      style={{ background: "var(--surface)" }}
    >
      <table aria-label={label} className="w-full border-separate border-spacing-0 text-[13px] text-[var(--foreground)]">
        <thead>
          <tr>
            {selection && (
              <th className={`${TH} w-11 pl-4 pr-0 rounded-tl-xl`}>
                <input
                  type="checkbox"
                  checked={selection.allSelected}
                  onChange={selection.onToggleAll}
                  aria-label={t("table.selectAll", { count: rows.length })}
                  title={t("table.selectAll", { count: rows.length })}
                  className="w-4 h-4 accent-[var(--foreground)] cursor-pointer align-middle"
                />
              </th>
            )}
            {columns.map((c, i) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={c.sort?.dir === "asc" ? "ascending" : c.sort?.dir === "desc" ? "descending" : undefined}
                className={`${TH} ${pad(!selection && i === 0, !actions && i === columns.length - 1)} ${
                  c.align === "right" ? "text-right" : ""
                } ${c.hide ? HIDE[c.hide] : ""} ${!selection && i === 0 ? "rounded-tl-xl" : ""} ${
                  !actions && i === columns.length - 1 ? "rounded-tr-xl" : ""
                }`}
              >
                {c.sort ? (
                  <button
                    type="button"
                    onClick={c.sort.onToggle}
                    className={`group/sort inline-flex items-center gap-1 uppercase tracking-[0.12em] hover:text-[var(--foreground)] transition-colors ${
                      c.align === "right" ? "flex-row-reverse" : ""
                    } ${c.sort.dir ? "text-[var(--foreground)]" : ""}`}
                  >
                    {c.header}
                    <SortArrow dir={c.sort.dir} />
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
            {actions && (
              <th className={`${TH} w-px pl-3 pr-4 rounded-tr-xl`}>
                <span className="sr-only">{t("table.actions")}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-12 text-center text-[var(--foreground-muted)]">
                {t("common.loading")}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colCount}>{empty ?? <EmptyState text={t("table.empty")} />}</td>
            </tr>
          ) : (
            shown.map((row, r) => {
              const id = rowKey(row);
              const isSelected = selection?.selected.has(id) ?? false;
              const last = r === shown.length - 1 && !paged;
              const cellBase = `h-[52px] border-t border-[var(--border)] ${r === 0 ? "border-t-0" : ""}`;
              return (
                <tr key={id} className={`group/row transition-colors ${isSelected ? "bg-[var(--fg-overlay-05)]" : "hover:bg-[var(--fg-overlay-05)]"}`}>
                  {selection && (
                    <td className={`${cellBase} w-11 pl-4 pr-0 ${last ? "rounded-bl-xl" : ""}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        // The modifier keys are on the native click event; a
                        // keyboard Space arrives without Shift and toggles one row.
                        onChange={(e) => selection.onToggle(id, (e.nativeEvent as MouseEvent).shiftKey === true)}
                        // Shift-click would otherwise also select the text between rows.
                        onMouseDown={(e) => {
                          if (e.shiftKey) e.preventDefault();
                        }}
                        aria-label={t("table.selectRow", { name: selection.rowLabel(row) })}
                        className="w-4 h-4 accent-[var(--foreground)] cursor-pointer align-middle"
                      />
                    </td>
                  )}
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={`${cellBase} ${pad(!selection && i === 0, !actions && i === columns.length - 1)} ${
                        c.grow ? "w-full max-w-0" : "whitespace-nowrap"
                      } ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.hide ? HIDE[c.hide] : ""} ${
                        last && !selection && i === 0 ? "rounded-bl-xl" : ""
                      } ${last && !actions && i === columns.length - 1 ? "rounded-br-xl" : ""}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                  {actions && (
                    // Pinned to the right edge on a phone, where the table is
                    // wider than the screen; a plain cell from md up.
                    <td
                      className={`${cellBase} w-px pl-3 pr-4 whitespace-nowrap sticky right-0 bg-[var(--surface)] shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.18)] md:static md:bg-transparent md:shadow-none ${
                        last ? "rounded-br-xl" : ""
                      }`}
                    >
                      <div className="flex items-center justify-end gap-0.5 md:opacity-0 md:group-hover/row:opacity-100 md:focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {paged && !loading && (
        <nav
          aria-label={t("table.pages")}
          className="flex flex-wrap items-center gap-1 min-h-12 px-4 py-2 border-t border-[var(--border)] text-[12px] text-[var(--foreground-muted)]"
        >
          <span className="tabular-nums mr-auto">
            {t("table.range", { from: start + 1, to: Math.min(start + pageSize, rows.length), total: rows.length })}
          </span>
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label={t("table.prev")}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[var(--border)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          {pageList(current, pageCount).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => go(p)}
                aria-current={p === current ? "page" : undefined}
                aria-label={t("table.page", { page: p + 1 })}
                className={`min-w-7 h-7 px-1.5 rounded-lg tabular-nums ${
                  p === current ? "bg-[var(--fg-overlay-08)] text-[var(--foreground)] font-medium" : "hover:text-[var(--foreground)]"
                }`}
              >
                {p + 1}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current >= pageCount - 1}
            aria-label={t("table.next")}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[var(--border)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
}

/** A 40px photo for the first column (ADMIN_DESIGN 5.8), on the product's own backdrop. */
export function Thumb({ src, bg }: { src?: string | null; bg?: string | null }) {
  return (
    <span
      className="w-10 h-10 flex-shrink-0 rounded-md overflow-hidden inline-flex items-center justify-center"
      style={{ background: bg || "var(--background)" }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain" />
      )}
    </span>
  );
}

/** One line of what is (not) here, and what to do about it (ADMIN_DESIGN 5.12). */
export function EmptyState({ text, action, icon }: { text: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="text-[var(--foreground-subtle)]" aria-hidden="true">
        {icon ?? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <p className="text-[13px] text-[var(--foreground-muted)] max-w-[48ch]">{text}</p>
      {action}
    </div>
  );
}
