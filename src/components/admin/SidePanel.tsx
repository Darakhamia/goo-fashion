"use client";

import { useId, useRef } from "react";
import type { ReactNode } from "react";
import { useOverlayPresence } from "@/lib/hooks/useOverlayPresence";
import { BTN_ICON } from "@/app/goo-studio/_ui/recipes";
import { useT } from "@/app/goo-studio/_i18n";
import { useDialog } from "./useDialog";

/*
 * The admin's side panel (docs/ADMIN_DESIGN.md 5.10, GS4-5): the details of a
 * row (a user, a retailer rule) and short forms ("Add rule"). It slides in from
 * the right, 480px wide, the whole screen on a phone.
 *
 *   <SidePanel open={!!rule} onClose={close} title="Edit farfetch.com"
 *     footer={<><button className={btn("ghost")}>Cancel</button><button className={btn("primary")}>Save</button></>}>
 *     …fields…
 *   </SidePanel>
 *
 * A header with the title and ✕, a body that scrolls, and the buttons at the
 * bottom, on the right. It is a modal dialog: Escape and a click on the dimmed
 * page close it, Tab stays inside, and focus goes back to whatever opened it.
 * A ConfirmDialog or a menu opened from inside keeps its own Escape and focus.
 */

export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** One quiet line under the title: an email, a domain. */
  subtitle?: ReactNode;
  /** The buttons: Cancel (ghost) and the main one, right-aligned. A destructive one goes first, `mr-auto`. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const ov = useOverlayPresence(open);
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  // Focus, Escape, Tab and the page's scroll, as every admin dialog (useDialog).
  useDialog(open, onClose, panelRef);

  if (!ov.rendered) return null;

  return (
    <div
      className={ov.cls("ov-scrim fixed inset-0 z-[90] flex justify-end bg-black/60")}
      onTransitionEnd={ov.onTransitionEnd}
      // Only a press that starts on the dimmed page closes it: a text
      // selection dragged out of a field ends here too.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ov-slide flex flex-col h-full w-full md:w-[480px] border-l border-[var(--border)] shadow-[-16px_0_40px_rgba(0,0,0,0.12)]"
        style={{ background: "var(--surface)" }}
      >
        <header className="flex items-center gap-3 min-h-16 pl-4 md:pl-6 pr-3 py-3 border-b border-[var(--border)]">
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] truncate">
              {title}
            </h2>
            {subtitle && <p className="text-[12px] leading-[18px] text-[var(--foreground-muted)] truncate">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className={BTN_ICON} aria-label={t("common.close")} title={t("common.close")}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 py-5">
          {children}
        </div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 px-4 md:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[var(--border)]">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}
