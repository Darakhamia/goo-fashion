"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useOverlayPresence } from "@/lib/hooks/useOverlayPresence";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { btn } from "@/app/goo-studio/_ui/recipes";
import { useT } from "@/app/goo-studio/_i18n";

/*
 * The admin's one confirmation (docs/ADMIN_DESIGN.md 5.12), in place of the
 * browser's confirm(): the title names the object and what happens to it, the
 * button names the action ("Delete 14 products", not "OK").
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete Valentino?", body: "Its 14 products go with it.",
 *     confirmLabel: "Delete brand", tone: "danger" }))) return;
 *
 * ConfirmProvider sits inside the admin root in goo-studio/_ui/AdminShell.tsx, so the
 * dialog takes the admin theme. One dialog at a time: asking again while one
 * is open answers the open one "no". Line breaks ("\n") in a string body are
 * kept.
 */

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" for anything that deletes, overwrites or can't be undone. */
  tone?: "default" | "danger";
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm() needs ConfirmProvider (goo-studio/_ui/AdminShell.tsx)");
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Kept after closing so the dialog still has its text while it fades out.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    resolver.current?.(false);
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
    returnFocus.current?.focus();
    returnFocus.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && <Dialog open={open} options={options} onAnswer={answer} />}
    </ConfirmContext.Provider>
  );
}

function Dialog({
  open,
  options,
  onAnswer,
}: {
  open: boolean;
  options: ConfirmOptions;
  onAnswer: (ok: boolean) => void;
}) {
  const ov = useOverlayPresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const danger = options.tone === "danger";
  const t = useT();
  useScrollLock(open);

  // Focus starts on the safe choice for destructive actions, on the action
  // otherwise. Escape answers "no"; Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return;
    (danger ? cancelRef : confirmRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onAnswer(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, danger, onAnswer]);

  if (!ov.rendered) return null;

  return (
    <div
      className={ov.cls("ov-scrim fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4")}
      onTransitionEnd={ov.onTransitionEnd}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onAnswer(false);
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.body ? bodyId : undefined}
        className="ov-panel w-full max-w-[400px] max-h-[90dvh] overflow-y-auto rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] break-words">
            {options.title}
          </h2>
          {options.body && (
            <div id={bodyId} className="text-[13px] leading-5 text-[var(--foreground-muted)] break-words whitespace-pre-line">
              {options.body}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={() => onAnswer(false)} className={btn("ghost")}>
            {options.cancelLabel ?? t("common.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onAnswer(true)}
            className={btn(danger ? "dangerSolid" : "primary")}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
