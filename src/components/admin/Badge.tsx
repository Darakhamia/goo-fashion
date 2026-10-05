import type { ReactNode } from "react";

/*
 * A short state next to a name (docs/ADMIN_DESIGN.md 5.4): "Banned", "Draft",
 * "Team". The default state gets no badge: an active user has none, only a
 * banned or overdue one does. `dot` is for a status in a row ("● Published").
 */

export type BadgeTone = "neutral" | "ok" | "warn" | "err" | "inverse";

// Neutral text is the full foreground: the muted one falls just short of AA
// on the tint (4.47:1 light, 4.29:1 dark).
const TONE: Record<BadgeTone, string> = {
  neutral: "bg-[var(--fg-overlay-08)] text-[var(--foreground)]",
  ok: "bg-[var(--ok-bg)] text-[var(--ok)]",
  warn: "bg-[var(--warn-bg)] text-[var(--warn)]",
  err: "bg-[var(--err-bg)] text-[var(--err)]",
  inverse: "bg-[var(--foreground)] text-[var(--surface)]",
};

export function Badge({
  tone = "neutral",
  dot = false,
  title,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex flex-shrink-0 items-center gap-1 h-5 px-2 rounded-full text-[11px] font-medium whitespace-nowrap ${TONE[tone]}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
