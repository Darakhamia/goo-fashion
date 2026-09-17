"use client";

import { useRef, type PointerEvent } from "react";

/**
 * Close a dialog when its backdrop is clicked — and only then.
 *
 * The usual `onClick={close}` on the backdrop has a fault that only shows up
 * once there is text to edit in the dialog. Select a word in a field, drag a
 * little past the panel's edge, let go: the browser dispatches `click` on the
 * nearest common ancestor of where the press started and where it ended, which
 * is the backdrop — so the dialog closes and the edit is lost, in the middle of
 * an ordinary text selection.
 *
 * Checking `event.target === event.currentTarget` inside that click does not
 * help, because the target genuinely *is* the backdrop in this case. What
 * separates the two gestures is where the press began. So this arms on the way
 * down and only dismisses if both ends of the gesture were on the backdrop
 * itself.
 *
 * Pointer events rather than mouse events, so a tap on a phone and a drag with
 * a stylus behave the same as a click.
 */
export function useBackdropDismiss(onDismiss: () => void) {
  const armed = useRef(false);

  return {
    onPointerDown: (e: PointerEvent) => {
      armed.current = e.target === e.currentTarget;
    },
    onPointerUp: (e: PointerEvent) => {
      const dismiss = armed.current && e.target === e.currentTarget;
      armed.current = false;
      if (dismiss) onDismiss();
    },
    // A pointer that is cancelled (a scroll takes over, the window loses it)
    // never produces an "up", and a stale arm would close the dialog on the
    // next release that happened to land on the backdrop.
    onPointerCancel: () => {
      armed.current = false;
    },
  };
}
