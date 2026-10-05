"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { Badge } from "./Badge";

/*
 * Tabs of a page (docs/ADMIN_DESIGN.md 5.9): "Outfits 27 · Pending 4". A 2px
 * underline marks the open one; a count is a neutral badge. Arrow keys move
 * between tabs, as in any tab list. The caller wraps the content in
 * `tabPanel(idBase, key)`, which ties it to its tab for screen readers.
 */

export type Tab<K extends string> = { key: K; label: string; count?: number };

const tabId = (idBase: string, key: string) => `${idBase}-tab-${key}`;
const panelId = (idBase: string) => `${idBase}-panel`;

/** Props for the element holding the open tab's content. */
export function tabPanel(idBase: string, key: string) {
  return { role: "tabpanel", id: panelId(idBase), "aria-labelledby": tabId(idBase, key) } as const;
}

export function Tabs<K extends string>({
  label,
  idBase,
  tabs,
  value,
  onChange,
}: {
  label: string;
  /** Unique on the page: the tabs' and the panel's ids start with it. */
  idBase: string;
  tabs: Tab<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.key === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].key);
    listRef.current?.querySelectorAll<HTMLElement>("[role=tab]")[next]?.focus();
  };

  return (
    <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKey} className="flex gap-6 border-b border-[var(--border)]">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={tabId(idBase, t.key)}
            aria-selected={on}
            aria-controls={on ? panelId(idBase) : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-2 h-10 -mb-px px-0.5 border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
              on
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
            {t.count !== undefined && <Badge>{t.count}</Badge>}
          </button>
        );
      })}
    </div>
  );
}
