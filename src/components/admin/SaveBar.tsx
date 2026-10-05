"use client";

import { useEffect } from "react";
import { useOverlayPresence } from "@/lib/hooks/useOverlayPresence";
import { btn } from "@/app/goo-studio/_ui/recipes";
import { useT } from "@/app/goo-studio/_i18n";

/*
 * The page's one Save (docs/ADMIN_DESIGN.md 5.11, GS4-5): a bar that sticks to
 * the bottom of the screen and shows only while there are unsaved changes —
 * "Unsaved changes · Discard · Save". It replaces a Save button in every block.
 * It goes last in the page. While it shows, leaving the page asks first.
 */

export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  disabled = false,
  note,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** Save is off: a part of the page did not load, so saving could overwrite what is live. */
  disabled?: boolean;
  /** Instead of "Unsaved changes": what is about to be saved, or why it cannot be. */
  note?: string;
}) {
  const t = useT();
  const shown = dirty || saving;
  const ov = useOverlayPresence(shown);

  // A reload or a closed tab would drop the changes without a word.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  if (!ov.rendered) return null;

  return (
    <div
      className={ov.cls("ov-rise sticky bottom-4 z-30 mt-6 flex justify-center pointer-events-none")}
      onTransitionEnd={ov.onTransitionEnd}
    >
      <div
        role="region"
        aria-label={t("save.bar")}
        className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2 w-full max-w-[720px] pl-4 pr-2 py-2 rounded-xl border border-[var(--border)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        style={{ background: "var(--surface)" }}
      >
        <span role="status" className="flex items-center gap-2 min-w-0 text-[13px] text-[var(--foreground)]">
          <span className="w-2 h-2 flex-shrink-0 rounded-full bg-[var(--warn)]" aria-hidden="true" />
          {note ?? t("save.unsaved")}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onDiscard} disabled={saving} className={btn("ghost")}>
            {t("save.discard")}
          </button>
          <button type="button" onClick={onSave} disabled={saving || disabled} className={btn("primary")}>
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </span>
      </div>
    </div>
  );
}
