"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { BTN_ICON, BTN_ICON_OUTLINE, BTN_ICON_SM } from "@/app/goo-studio/_ui/recipes";

/*
 * Dropdowns of goo-studio: the "…" menu of a table row (RowMenu), the
 * Maintenance menu of a page header, and the panels of FilterMenu.
 *
 * The panel is position: fixed, placed from the trigger's rectangle, and
 * rendered into the admin root through a portal: a table that scrolls
 * sideways on a phone cannot clip it, and the pinned (sticky) actions column —
 * a stacking context of its own — cannot paint over it. The admin root keeps
 * the admin theme. It opens upward when there is more room above, and closes
 * on Escape (focus back to the trigger), on a click outside, and when the page
 * under it scrolls or resizes.
 */

export type PopoverAlign = "start" | "end";

type Place = { top?: number; bottom?: number; left?: number; right?: number; maxHeight: number };

export function usePopover(align: PopoverAlign = "end") {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  /** Where the panel goes for the trigger's current rectangle; null when the trigger is off screen. */
  const measure = useCallback((): Place | null => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r || r.bottom < 0 || r.top > window.innerHeight) return null;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 240 && above > below;
    const side = align === "end" ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, r.left) };
    return {
      ...side,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      maxHeight: Math.max(160, (up ? above : below) - 4),
    };
  }, [align]);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    const trigger = triggerRef.current;
    const next = measure();
    if (!trigger || !next) return;
    setHost(trigger.closest<HTMLElement>(".admin-theme-light, .admin-theme-dark") ?? document.body);
    setPlace(next);
    setOpen(true);
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    // The panel is fixed, so it follows its trigger when the page scrolls
    // (a smooth scroll can still be running when it opens), and closes once
    // the trigger has left the screen. Scrolling inside the panel is not that.
    const follow = (e?: Event) => {
      if (e && panelRef.current?.contains(e.target as Node)) return;
      const next = measure();
      if (next) setPlace(next);
      else close(false);
    };
    const onScroll = (e: Event) => follow(e);
    const onResize = () => follow();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close, measure]);

  const style: CSSProperties | undefined = place
    ? { position: "fixed", ...place, background: "var(--surface)" }
    : { position: "fixed", visibility: "hidden", background: "var(--surface)" };

  /** Renders the open panel into the admin root. */
  const portal = (panel: ReactNode) => (open && host ? createPortal(panel, host) : null);

  return { open, toggle, close, triggerRef, panelRef, panelId, style, portal };
}

/** The panel recipe: a floating layer, like the account menu. */
export const POPOVER_PANEL =
  "z-[60] min-w-[200px] max-w-[min(360px,calc(100vw-16px))] overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]";

export type MenuItem =
  | {
      kind?: "item";
      label: string;
      onSelect: () => void;
      /** Destructive: shown last, in red; the action itself asks ConfirmDialog. */
      tone?: "danger";
      disabled?: boolean;
      /** A second, quieter line under the label. */
      hint?: string;
      icon?: ReactNode;
    }
  | { kind: "separator" }
  | { kind: "label"; label: string };

/** Moves focus between the enabled items of a menu with the arrow keys. */
function useRovingFocus(panelRef: RefObject<HTMLDivElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = () => [...panel.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])')];
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      let next = -1;
      if (e.key === "ArrowDown") next = (i + 1) % list.length;
      else if (e.key === "ArrowUp") next = (i - 1 + list.length) % list.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = list.length - 1;
      if (next >= 0) {
        e.preventDefault();
        list[next]?.focus();
      }
    };
    panel.addEventListener("keydown", onKey);
    return () => panel.removeEventListener("keydown", onKey);
  }, [panelRef, open]);
}

const ITEM =
  "w-full flex items-start gap-2.5 px-3 py-2.5 md:py-2 text-left text-[13px] transition-colors hover:bg-[var(--fg-overlay-05)] focus-visible:bg-[var(--fg-overlay-05)] disabled:opacity-40 disabled:cursor-not-allowed";

export function Menu({
  label,
  trigger,
  triggerClassName,
  triggerTitle,
  items,
  align = "end",
  disabled = false,
}: {
  /** Names the menu and its button for screen readers ("More actions for …"). */
  label: string;
  /** What the button shows: an icon, or text and a chevron. */
  trigger: ReactNode;
  triggerClassName: string;
  triggerTitle?: string;
  items: MenuItem[];
  align?: PopoverAlign;
  disabled?: boolean;
}) {
  const { open, toggle, close, triggerRef, panelRef, panelId, style, portal } = usePopover(align);
  useRovingFocus(panelRef, open);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        title={triggerTitle ?? label}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {portal(
        <div ref={panelRef} id={panelId} role="menu" aria-label={label} className={`ov-pop ${POPOVER_PANEL}`} style={style}>
          {items.map((item, i) => {
            if (item.kind === "separator") return <div key={i} role="separator" className="my-1 border-t border-[var(--border)]" />;
            if (item.kind === "label")
              return (
                <p key={i} className="px-3 pt-2 pb-1 text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)]">
                  {item.label}
                </p>
              );
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={`${ITEM} ${item.tone === "danger" ? "text-[var(--err)]" : "text-[var(--foreground)]"}`}
              >
                {item.icon && <span className="mt-0.5 flex-shrink-0 text-[var(--foreground-muted)]">{item.icon}</span>}
                <span className="flex flex-col min-w-0">
                  <span>{item.label}</span>
                  {item.hint && <span className="text-[12px] text-[var(--foreground-muted)]">{item.hint}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

const DOTS = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/**
 * The "…" of a table row (`size="sm"`) or of a page header (`outline`, next to
 * the main action): everything that is not the main action.
 */
export function RowMenu({
  label,
  items,
  size = "md",
  outline = false,
}: {
  label: string;
  items: MenuItem[];
  size?: "sm" | "md";
  outline?: boolean;
}) {
  return (
    <Menu
      label={label}
      trigger={DOTS}
      items={items}
      triggerClassName={outline ? BTN_ICON_OUTLINE : size === "sm" ? BTN_ICON_SM : BTN_ICON}
    />
  );
}
