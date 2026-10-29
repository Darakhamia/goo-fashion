"use client";

import { AnimatePresence, motion } from "framer-motion";

/**
 * The "…" over a look's photo: download it, or shoot it again in a style
 * chosen on the style sheet (StylePicker) — mannequin, flat lay, on you, or no
 * photo at all.
 *
 * Lifted out of My looks so the Builder's Save look carries the same one: the
 * photo could only be redone after saving, by finding the look in My looks
 * (CEO, 2026-10-29). A look without a photo gets the menu too, as "Generate
 * photo" — before, a collage look had no way to get one short of the Builder.
 *
 * Deliberately not a `fixed` popover: the dialogs around it animate `scale`,
 * and a transform makes the dialog the containing block for fixed descendants,
 * which laid the panel out against the dialog and clipped it (the black bar
 * across the photo). An absolute panel sits against the button and fits inside
 * the picture, so no clipping engages.
 */
export function LookPhotoMenu({
  open,
  onOpenChange,
  hasImage,
  busy,
  error,
  onDownload,
  onRegenerate,
  className = "absolute top-3 right-3",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasImage: boolean;
  /** Which action is running; the items refuse a second one. */
  busy: "download" | "regenerate" | null;
  error: string | null;
  onDownload?: () => void;
  onRegenerate: () => void;
  /** Where the button sits on the photo. */
  className?: string;
}) {
  const item =
    "w-full flex items-center gap-2.5 px-4 py-3 md:py-2.5 text-left text-[14px] md:text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-40 transition-colors";
  return (
    <div className={`${className} z-30`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Photo actions"
        aria-expanded={open}
        className="w-11 h-11 md:w-9 md:h-9 rounded-full bg-[var(--background)]/85 backdrop-blur-sm flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
              className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl py-1.5"
            >
              {hasImage && onDownload && (
                <button type="button" onClick={onDownload} disabled={!!busy} className={item}>
                  {busy === "download" ? "Downloading…" : "Download image"}
                </button>
              )}
              <button type="button" onClick={onRegenerate} disabled={!!busy} className={item}>
                {busy === "regenerate" ? "Drawing…" : hasImage ? "Regenerate photo" : "Generate photo"}
              </button>
              {error ? (
                <p role="alert" className="px-4 pt-2 pb-1 text-[11px] md:text-[10px] leading-snug text-red-500">
                  {error}
                </p>
              ) : (
                <p className="px-4 pt-2 pb-1 text-[11px] md:text-[10px] leading-snug text-[var(--foreground-subtle)]">
                  Choose how it is shot — mannequin, flat lay, on you, or no photo.
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
