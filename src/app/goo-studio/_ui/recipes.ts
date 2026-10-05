/*
 * Button and field recipes for goo-studio (docs/ADMIN_DESIGN.md 5.3,
 * DESIGN_SYSTEM.md §9). Class strings, not a component: CLAUDE.md forbids a
 * shared button primitive competing with the recipes.
 *
 * One utility per property: each recipe sets its own height, padding and
 * colours, so a call site adds layout (`w-full`, `ml-auto`) but never a second
 * height, padding, text size or colour. Below md the admin's base layer lifts
 * every button to 40px (globals.css), so `h-8` is the desktop size only.
 */

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity] disabled:opacity-40 disabled:cursor-not-allowed";

const SIZE = {
  md: "h-8 px-3 text-[13px]",
  /** Inside a table row. */
  sm: "h-7 px-2.5 text-[13px]",
  /** The main action pinned to the bottom of a phone's screen (PageHeader). */
  lg: "h-12 px-4 text-[15px]",
} as const;

const KIND = {
  /** The one main action of a page or block. */
  primary: "bg-[var(--foreground)] text-[var(--surface)] hover:opacity-85",
  /** Everything else that is a button (Р14 canon). */
  secondary:
    "border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]",
  /** Quiet actions next to others: Cancel, Dismiss, Undo. */
  ghost:
    "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]",
  /** A destructive action shown among others. */
  danger: "border border-[var(--err-line)] text-[var(--err)] hover:bg-[var(--err-bg)]",
  /** The confirming button of a destructive ConfirmDialog. */
  dangerSolid: "bg-[var(--err)] text-[var(--surface)] hover:opacity-85",
} as const;

export type ButtonKind = keyof typeof KIND;

/** `btn("secondary")`, `btn("primary", "sm")`. */
export function btn(kind: ButtonKind, size: keyof typeof SIZE = "md"): string {
  return `${BTN_BASE} ${SIZE[size]} ${KIND[kind]}`;
}

export const BTN_PRIMARY = btn("primary");
export const BTN_SECONDARY = btn("secondary");
export const BTN_GHOST = btn("ghost");
export const BTN_DANGER = btn("danger");

/** Icon-only button; always give it an aria-label (and a title). */
export const BTN_ICON =
  "inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/** Icon-only with the secondary outline: the "…" next to a page's main action. */
export const BTN_ICON_OUTLINE =
  "inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/** The same, 28px, for a table row (ADMIN_DESIGN 5.3: h-7 in a row). */
export const BTN_ICON_SM =
  "inline-flex items-center justify-center w-7 h-7 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

const FIELD_BASE =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";

/** Text field and textarea. */
export const INPUT = `${FIELD_BASE} bg-transparent`;
/** A select paints its own background, or the native popup shows through. */
export const SELECT = `${FIELD_BASE} bg-[var(--surface)]`;

export const FIELD_LABEL = "block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5";
