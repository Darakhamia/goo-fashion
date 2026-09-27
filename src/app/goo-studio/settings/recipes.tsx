// Shared admin recipes for the Settings page and its cards
// (DESIGN_SYSTEM.md §9: primary/secondary button, input, loading line).

export const PRIMARY_BTN =
  "bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5";
export const SECONDARY_BTN =
  "px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5";
export const INPUT =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

export function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Spinner className="text-[var(--foreground-subtle)]" />
      <p className="text-[11px] text-[var(--foreground-subtle)]">{label}</p>
    </div>
  );
}
