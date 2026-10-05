// Pieces shared by the Settings page and its cards: loading indicators, and the
// two ways their text goes through the dictionary. Buttons and fields come from
// the admin-wide recipes in ../_ui/recipes (docs/ADMIN_DESIGN.md 5.3).

import { Fragment } from "react";
import type { ReactNode } from "react";
import type { Key, T, Vars } from "../_i18n";

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

/**
 * An error to show. The server's own words stay as they came; one of ours is
 * kept as its dictionary key, so it follows a language switch without the
 * loaders running again (the ones run on mount would otherwise keep the
 * language of the first render).
 */
export type Failure = string | { key: Key; vars?: Vars };

export function sayFailure(f: Failure, t: T): string {
  return typeof f === "string" ? f : t(f.key, f.vars);
}

/**
 * A dictionary message with elements in it: t() leaves a {name} it was not
 * given as it is, and this puts the element there. "Add your Clerk user ID to
 * the {env} environment variable" with { env: <code>ADMIN_USER_IDS</code> }.
 */
export function withSlots(text: string, slots: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name && name in slots ? <Fragment key={i}>{slots[name]}</Fragment> : part;
  });
}
