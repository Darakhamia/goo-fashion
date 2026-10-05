"use client";

import { useT } from "@/app/goo-studio/_i18n";
import { Menu } from "./Menu";
import type { MenuItem } from "./Menu";

/*
 * What to do with the selected rows (docs/ADMIN_DESIGN.md 5.8, GS4-4): an
 * inverse bar that sticks to the bottom of the screen while the table is in
 * view — "3 selected · Edit · Group · Delete… ✕". It goes in the page right
 * after the DataTable. Destructive actions come last, in red, after a rule;
 * they ask ConfirmDialog themselves. An action with a choice to make ("Set
 * plan ▾") opens a menu of it instead of running at once.
 */

export type BulkAction = {
  key: string;
  label: string;
  onClick?: () => void;
  /** The choices of an action that needs one; opens above the bar. */
  menu?: MenuItem[];
  tone?: "danger";
  disabled?: boolean;
  title?: string;
};

const CHEVRON = (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BTN =
  "h-8 px-3 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-[var(--inverse-hover)] focus-visible:outline-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed";

export function BulkBar({ count, actions, onClear }: { count: number; actions: BulkAction[]; onClear: () => void }) {
  const t = useT();
  if (count === 0) return null;
  const plain = actions.filter((a) => a.tone !== "danger");
  const danger = actions.filter((a) => a.tone === "danger");
  return (
    // data-bulk-bar: a page's pinned main action steps aside while it shows (PageHeader).
    <div data-bulk-bar className="sticky bottom-4 z-30 mt-4 flex justify-center pointer-events-none">
      <div
        role="toolbar"
        aria-label={t("bulk.selected", { count })}
        className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 max-w-full pl-4 pr-1.5 py-1.5 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.18)] bg-[var(--foreground)] text-[var(--surface)]"
      >
        <span className="mr-2 text-[13px] font-medium tabular-nums">{t("bulk.selected", { count })}</span>
        {plain.map((a) =>
          a.menu ? (
            <Menu
              key={a.key}
              label={a.label}
              trigger={
                <>
                  {a.label}
                  {CHEVRON}
                </>
              }
              triggerTitle={a.title}
              triggerClassName={`${BTN} inline-flex items-center gap-1.5`}
              items={a.menu}
              align="start"
              disabled={a.disabled}
            />
          ) : (
            <button key={a.key} type="button" onClick={a.onClick} disabled={a.disabled} title={a.title} className={BTN}>
              {a.label}
            </button>
          )
        )}
        {danger.length > 0 && <span className="w-px h-5 mx-1 bg-[var(--surface)] opacity-30" aria-hidden="true" />}
        {danger.map((a) => (
          <button key={a.key} type="button" onClick={a.onClick} disabled={a.disabled} title={a.title} className={`${BTN} text-[var(--err-on-inverse)]`}>
            {a.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClear}
          aria-label={t("bulk.clear")}
          title={t("bulk.clear")}
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-[var(--inverse-hover)] focus-visible:outline-[var(--surface)]"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
