"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useFormat, useT } from "@/app/goo-studio/_i18n";
import { POPOVER_PANEL, usePopover } from "./Menu";

/*
 * Filters above a table (docs/ADMIN_DESIGN.md 5.7, GS4-4):
 *
 *   [Search……………]  [Brand: All ▾] [Category: Tops ▾] …           [Sort: Newest ▾]
 *   (Category: Tops ✕) (Missing: photo ✕)  Clear all                412 of 1,224
 *
 * A filter is a button showing its name and current value; its panel lists
 * the choices (with a search box when there are many). What is active shows
 * again as removable chips under the row, so it is visible what narrowed the
 * list and each one goes with one click.
 */

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 h-10 md:h-8 w-full sm:w-[280px] px-2.5 rounded-lg border border-[var(--border)] focus-within:border-[var(--foreground)] text-[var(--foreground-muted)] transition-colors bg-[var(--surface)]">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="flex-shrink-0">
        <path d="M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="flex-1 min-w-0 min-h-0 h-full bg-transparent outline-none text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]"
      />
    </label>
  );
}

export type FilterOption = { value: string; label: string; /** Indented under the option above (subcategory). */ nested?: boolean };

export function FilterMenu({
  label,
  value,
  options,
  onChange,
  allLabel,
  searchable = false,
  tone,
  variant = "outline",
  align = "start",
}: {
  label: string;
  /** "" means no filter. */
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
  /** The "no filter" choice; leave out for a menu that always has a value (sort). */
  allLabel?: string;
  /** A search box over the choices, for long lists like brands. */
  searchable?: boolean;
  /** "warn": an active filter that looks for problems (missing fields). */
  tone?: "warn";
  variant?: "outline" | "ghost";
  align?: "start" | "end";
}) {
  const t = useT();
  const { open, toggle, close, triggerRef, panelRef, panelId, style, portal } = usePopover(align);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value);
  const shownValue = current?.label ?? allLabel ?? "";
  const active = value !== "" && allLabel !== undefined;
  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  // Opening puts focus where typing or arrows start: the search box, or the
  // chosen option.
  useEffect(() => {
    if (!open) return;
    if (searchable) searchRef.current?.focus();
    else (listRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? listRef.current?.querySelector<HTMLElement>("[role=menuitemradio]"))?.focus();
  }, [open, searchable]);

  const onListKey = (e: React.KeyboardEvent) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(items.length - 1, i + 1);
    else if (e.key === "ArrowUp") {
      if (i <= 0 && searchable) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      next = Math.max(0, i - 1);
    }
    if (next >= 0) {
      e.preventDefault();
      items[next]?.focus();
    }
  };

  const choose = (v: string) => {
    onChange(v);
    close();
  };

  const border =
    variant === "ghost"
      ? "border-transparent"
      : active
        ? tone === "warn"
          ? "border-[var(--warn-line)]"
          : "border-[var(--foreground)]"
        : "border-[var(--border)] hover:border-[var(--border-strong)]";

  const item = (o: { value: string; label: string; nested?: boolean }, key: string) => (
    <button
      key={key}
      type="button"
      role="menuitemradio"
      aria-checked={o.value === value}
      onClick={() => choose(o.value)}
      className={`w-full flex items-center gap-2 py-2 md:py-1.5 pr-3 text-left text-[13px] text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] focus-visible:bg-[var(--fg-overlay-05)] ${
        o.nested ? "pl-8" : "pl-3"
      }`}
    >
      <span className="w-3 flex-shrink-0" aria-hidden="true">
        {o.value === value && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5L5 9l4.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="truncate">{o.label}</span>
    </button>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          // A fresh search each time it opens.
          setQuery("");
          toggle();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-lg border text-[13px] whitespace-nowrap transition-colors bg-[var(--surface)] ${border}`}
      >
        <span className="text-[var(--foreground-muted)]">{label}</span>
        <span className={`font-medium truncate max-w-[160px] ${active && tone === "warn" ? "text-[var(--warn)]" : "text-[var(--foreground)]"}`}>
          {shownValue}
        </span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[var(--foreground-muted)]">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {portal(
        <div ref={panelRef} id={panelId} className={`ov-pop ${POPOVER_PANEL} flex flex-col`} style={style}>
          {searchable && (
            <div className="px-2 pt-1 pb-1.5 border-b border-[var(--border)]">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    listRef.current?.querySelector<HTMLElement>("[role=menuitemradio]")?.focus();
                  }
                }}
                placeholder={t("filter.search")}
                aria-label={t("filter.searchIn", { label })}
                className="w-full min-h-0 h-10 md:h-8 px-2 rounded-md bg-transparent outline-none text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]"
              />
            </div>
          )}
          <div ref={listRef} role="menu" aria-label={label} onKeyDown={onListKey} className="py-1">
            {allLabel !== undefined && !q && item({ value: "", label: allLabel }, "__all")}
            {visible.map((o) => item(o, o.value))}
            {visible.length === 0 && <p className="px-3 py-2 text-[13px] text-[var(--foreground-muted)]">{t("filter.noMatches")}</p>}
          </div>
        </div>
      )}
    </>
  );
}

export type ChipOption = { value: string; label: string; count?: number };

/**
 * One filter shown as chips with counts, when its few values are worth seeing
 * at a glance: "All 14 · Free 9 · Basic 2 · Pro 1 · Premium 2" (Users), "All 8
 * · Published 5 · Drafts 3" (Blog). Exactly one is on.
 */
export function FilterChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ChipOption[];
  onChange: (v: string) => void;
}) {
  const f = useFormat();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] font-medium whitespace-nowrap transition-colors ${
              on
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--border-strong)]"
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className="text-[12px] font-normal opacity-70 tabular-nums">{f.number(o.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export type ActiveFilter = { key: string; label: string; onRemove: () => void };

export function ActiveFilters({
  filters,
  onClearAll,
  count,
  trailing,
}: {
  filters: ActiveFilter[];
  onClearAll: () => void;
  /** "412 of 1,224", right-aligned. */
  count: ReactNode;
  /** After the count: the sort menu, when the filter row has no room for it. */
  trailing?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2 min-h-6 text-[12px] text-[var(--foreground-muted)]">
      {filters.map((f) => (
        // The whole chip removes its filter: a 10px cross alone is no target
        // for a finger.
        <button
          key={f.key}
          type="button"
          onClick={f.onRemove}
          aria-label={t("filter.remove", { label: f.label })}
          title={t("filter.remove", { label: f.label })}
          className="group/chip min-h-0 inline-flex items-center gap-1.5 h-8 md:h-6 pl-2.5 pr-2 rounded-full bg-[var(--fg-overlay-08)] text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors"
        >
          {f.label}
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[var(--foreground-muted)] group-hover/chip:text-[var(--foreground)]">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      ))}
      {filters.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="min-h-0 h-8 md:h-6 px-1.5 underline underline-offset-[3px] hover:text-[var(--foreground)]"
        >
          {t("filter.clearAll")}
        </button>
      )}
      <span className="ml-auto flex items-center gap-2">
        <span className="tabular-nums">{count}</span>
        {trailing}
      </span>
    </div>
  );
}
