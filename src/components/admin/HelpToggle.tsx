"use client";

import type { ReactNode } from "react";
import { useSetting, writeSetting } from "@/app/goo-studio/_ui/settings";

/*
 * Explanations behind a "?" (docs/ADMIN_DESIGN.md 5.12): the page opens on
 * the work, and the paragraph about how it works is one click away. Whether
 * a panel is open is remembered per browser (localStorage), so someone who
 * wants the text keeps seeing it. A click, not a hover, so it works on touch.
 *
 *   const help = useHelp("retailers");
 *   <h1>Retailers</h1> <HelpButton help={help} label="How retailer rules work" />
 *   <HelpPanel help={help}><p>…</p></HelpPanel>
 */

export type Help = { open: boolean; panelId: string; toggle: () => void };

export function useHelp(id: string): Help {
  const key = `goo-admin-help-${id}`;
  const open = useSetting(key) === "open";
  return {
    open,
    panelId: `admin-help-${id}`,
    toggle: () => writeSetting(key, open ? null : "open"),
  };
}

export function HelpButton({ help, label }: { help: Help; label: string }) {
  return (
    <button
      type="button"
      onClick={help.toggle}
      aria-expanded={help.open}
      aria-controls={help.panelId}
      aria-label={label}
      title={label}
      className="group/help inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 align-middle"
    >
      <span
        className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-medium transition-colors ${
          help.open
            ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
            : "border-[var(--border-strong)] text-[var(--foreground-muted)] group-hover/help:border-[var(--foreground)] group-hover/help:text-[var(--foreground)]"
        }`}
        aria-hidden="true"
      >
        ?
      </span>
    </button>
  );
}

export function HelpPanel({ help, children }: { help: Help; children: ReactNode }) {
  if (!help.open) return null;
  return (
    <div
      id={help.panelId}
      className="rounded-xl border border-[var(--border)] px-4 py-3 text-[13px] leading-5 text-[var(--foreground-muted)] flex flex-col gap-2 max-w-[80ch]"
      style={{ background: "var(--surface)" }}
    >
      {children}
    </div>
  );
}
