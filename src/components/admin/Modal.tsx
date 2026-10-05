"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { useDialog } from "./useDialog";

/*
 * A dialog in the middle of the screen (GS4-9): an editor, a picker, an AI
 * draft. Mount it while it is open:
 *
 *   {open && (
 *     <Modal onClose={close} label="Save template" panelClassName="w-full max-w-sm …">…</Modal>
 *   )}
 *
 * `role="dialog"`, a dimmed page (black 60%), Escape closes, Tab stays inside,
 * focus starts in the first field and goes back to the opener. A press on the
 * dimmed page closes it too — except an editor (`closeOnScrim={false}`), where
 * a stray click would throw the form away. For the details of a row, use
 * SidePanel; for a yes/no, ConfirmDialog.
 */

export function Modal({
  onClose,
  label,
  labelledBy,
  panelClassName,
  scrimClassName = "flex items-center justify-center p-4",
  closeOnScrim = true,
  children,
}: {
  onClose: () => void;
  /** Names the dialog; or `labelledBy`, the id of its heading. */
  label?: string;
  labelledBy?: string;
  /** Size and layout of the panel: width, height, scrolling, rounding. */
  panelClassName: string;
  /** Placement on the dimmed page; the editors scroll the page instead of the panel on wide screens. */
  scrimClassName?: string;
  closeOnScrim?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(true, onClose, panelRef);

  return (
    <div
      className={`ov-scrim fixed inset-0 z-50 bg-black/60 ${scrimClassName}`}
      // Only a press that starts on the dimmed page: a text selection dragged
      // out of a field ends here too.
      onMouseDown={(e) => {
        if (closeOnScrim && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`ov-panel border border-[var(--border)] outline-none ${panelClassName}`}
        style={{ background: "var(--surface)" }}
      >
        {children}
      </div>
    </div>
  );
}
