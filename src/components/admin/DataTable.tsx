"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useT } from "@/app/goo-studio/_i18n";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

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
 *   table back to the first page when the filters or the sort change. A list
 *   the server pages (Users) passes `paging`: `rows` is then the current page.
 * - Selection is the caller's: a checkbox column when `selection` is given,
 *   Shift-click for a run of rows (the caller decides what a run is).
 * - `onRowClick` opens the row (Users: the side panel). The row's own buttons
 *   and boxes keep their clicks, and the same action stays a button in
 *   `actions` for the keyboard.
 * - On a phone (below md) a table given `card` becomes a list of cards
 *   (GS4-11, mockup "Phone · Products"): the 56px photo, the name on up to two
 *   lines, one muted line under it, and the row's "…" on the right — nothing
 *   to scroll sideways. A tap on the photo selects the row: the photo is the
 *   checkbox, with a circle in its corner saying so.
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
  /** Some rows, not all, are selected: the header box shows a dash. */
  someSelected?: boolean;
  /** Names the row for its checkbox ("Select Athleticz oversized T-shirt"). */
  rowLabel: (row: T) => string;
  /** A row that cannot be selected gets no checkbox (a super admin). */
  canSelect?: (row: T) => boolean;
};

/** Pages cut by the server: `rows` holds the current page only. */
export type Paging = {
  /** From 0. */
  page: number;
  /** Rows on all pages. */
  total: number;
  onPage: (page: number) => void;
  /** A remark next to "1–25 of 140"; the footer shows for it even on one page. */
  note?: ReactNode;
};

/** What a row shows as a card on a phone. */
export type Card = {
  /** The 56px picture: `<Thumb size="lg">`, an avatar. */
  thumb?: ReactNode;
  /** The name, on up to two lines. */
  title: ReactNode;
  /** One muted line: "Zara · $29.90–$32.29", "email · Basic". */
  meta?: ReactNode;
  /** A status that must not be missed, after the name: Draft, Banned. */
  badge?: ReactNode;
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
  paging,
  onRowClick,
  card,
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
  paging?: Paging;
  onRowClick?: (row: T) => void;
  /** The row as a card on a phone; without it the phone gets the table. */
  card?: (row: T) => Card;
}) {
  const t = useT();
  const phone = useMediaQuery("(width < 48rem)");
  const topRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setPage(0);
  }

  const total = paging ? paging.total : rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = paging ? paging.page : Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const shown = paging ? rows : rows.slice(start, start + pageSize);
  const paged = total > pageSize;
  const footer = (paged || paging?.note !== undefined) && !loading && rows.length > 0;
  const Footer = paged ? "nav" : "div";
  const colCount = columns.length + (selection ? 1 : 0) + (actions ? 1 : 0);

  // Clicks on the row's own controls, and inside a menu portalled out of it,
  // are theirs.
  const rowClick = (row: T) =>
    onRowClick
      ? (e: React.MouseEvent<HTMLElement>) => {
          const target = e.target as HTMLElement;
          if (!e.currentTarget.contains(target) || target.closest("button, a, input, label, select, textarea")) return;
          onRowClick(row);
        }
      : undefined;

  const go = (p: number) => {
    if (paging) paging.onPage(p);
    else setPage(p);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const pager = footer && (
    // A landmark only when there are pages to go to.
    <Footer
      aria-label={paged ? t("table.pages") : undefined}
      className="flex flex-wrap items-center gap-1 min-h-12 px-4 py-2 border-t border-[var(--border)] text-[12px] text-[var(--foreground-muted)]"
    >
      <span className="tabular-nums mr-auto">
        {t("table.range", { from: start + 1, to: start + shown.length, total })}
        {paging?.note !== undefined && <> · {paging.note}</>}
      </span>
      {paged && (
        <>
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
        </>
      )}
    </Footer>
  );

  if (phone && card) {
    return (
      <div ref={topRef} className="scroll-mt-4 rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: "var(--surface)" }}>
        {loading ? (
          <p className="px-4 py-12 text-center text-[13px] text-[var(--foreground-muted)]">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          (empty ?? <EmptyState text={t("table.empty")} />)
        ) : (
          <ul aria-label={label} className="text-[var(--foreground)]">
            {shown.map((row, r) => {
              const id = rowKey(row);
              const c = card(row);
              const isSelected = selection?.selected.has(id) ?? false;
              const selectable = !!selection && (selection.canSelect?.(row) ?? true);
              return (
                <li
                  key={id}
                  data-row
                  onClick={rowClick(row)}
                  className={`flex items-center gap-3 min-h-[76px] py-2.5 pl-3 pr-1 ${r > 0 ? "border-t border-[var(--border)]" : ""} ${
                    isSelected ? "bg-[var(--fg-overlay-05)]" : ""
                  } ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  {selectable ? (
                    // The photo is the checkbox: a finger-sized target, and the
                    // circle in its corner says it selects.
                    <label className={`relative flex-shrink-0 cursor-pointer ${c.thumb ? "" : "flex items-center justify-center w-10 h-10"}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => selection.onToggle(id, false)}
                        aria-label={t("table.selectRow", { name: selection.rowLabel(row) })}
                        className="peer sr-only"
                      />
                      {c.thumb && (
                        <span className="flex rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--foreground)]">
                          {c.thumb}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className={`${c.thumb ? "absolute -top-1 -left-1" : ""} flex items-center justify-center w-5 h-5 rounded-full border shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors ${
                          isSelected
                            ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                            : "border-[var(--border-strong)] bg-[var(--surface)] text-transparent"
                        }`}
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6.5L5 9l4.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </label>
                  ) : (
                    c.thumb
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] leading-[19px] font-medium line-clamp-2 break-words">{c.title}</div>
                    {(c.meta || c.badge) && (
                      <div className="flex items-center gap-1.5 min-w-0 mt-0.5 text-[12px] leading-[17px] text-[var(--foreground-muted)]">
                        {c.badge}
                        <span className="truncate">{c.meta}</span>
                      </div>
                    )}
                  </div>
                  {actions && <div className="flex flex-shrink-0 items-center">{actions(row)}</div>}
                </li>
              );
            })}
          </ul>
        )}
        {pager}
      </div>
    );
  }

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
                  ref={(el) => {
                    if (el) el.indeterminate = !!selection.someSelected && !selection.allSelected;
                  }}
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
              const last = r === shown.length - 1 && !footer;
              const cellBase = `h-[52px] border-t border-[var(--border)] ${r === 0 ? "border-t-0" : ""}`;
              return (
                <tr
                  key={id}
                  data-row
                  onClick={rowClick(row)}
                  className={`group/row transition-colors ${isSelected ? "bg-[var(--fg-overlay-05)]" : "hover:bg-[var(--fg-overlay-05)]"} ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {selection && (
                    <td className={`${cellBase} w-11 pl-4 pr-0 ${last ? "rounded-bl-xl" : ""}`}>
                      {(selection.canSelect?.(row) ?? true) && (
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
                      )}
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

      {pager}
    </div>
  );
}

/**
 * A 40px photo for the first column (ADMIN_DESIGN 5.8): a product whole, on its
 * own backdrop; a look or a blog cover (`fit="cover"`) filling the square.
 * `size="lg"` is the 56px one of a card on a phone.
 */
export function Thumb({
  src,
  bg,
  fit = "contain",
  size = "md",
}: {
  src?: string | null;
  bg?: string | null;
  fit?: "contain" | "cover";
  size?: "md" | "lg";
}) {
  return (
    <span
      className={`${size === "lg" ? "w-14 h-14 rounded-lg" : "w-10 h-10 rounded-md"} flex-shrink-0 overflow-hidden inline-flex items-center justify-center`}
      style={{ background: bg || "var(--background)" }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className={`w-full h-full ${fit === "cover" ? "object-cover" : "object-contain"}`} />
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
