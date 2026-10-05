"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { btn } from "@/app/goo-studio/_ui/recipes";
import { useT } from "@/app/goo-studio/_i18n";
import { RowMenu, type MenuItem } from "./Menu";

/*
 * The head of an admin page (docs/ADMIN_DESIGN.md 5.2, GS4-11):
 *
 *   Products                                  [Import] [+ Add product] […]
 *   41 products · 21 added in the last 30 days
 *
 * On the left the title and one line of numbers. On the right, in this order:
 * the secondary actions (outlined, two at most), the main one (filled, one),
 * and "…" for the rest.
 *
 * On a phone the head keeps the title and "…", which then also holds the
 * secondary actions, and the main action becomes a full-width button pinned to
 * the bottom of the screen (mockup "Phone · Products"). It leaves the bottom
 * to the BulkBar while rows are selected.
 */

export type HeaderAction = {
  key: string;
  label: string;
  /** A 12px icon before the label (the "+" of Add). */
  icon?: ReactNode;
  onClick?: () => void;
  /** A link to another page instead of a click. */
  href?: string;
  disabled?: boolean;
  /** Why it is disabled, as a tooltip. */
  title?: string;
};

/** The "+" of an Add action. */
export const PLUS = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

/** Where the pinned main action goes: the bottom of the shell's scrolling area (AdminShell). */
export const PinnedActionSlot = createContext<HTMLElement | null>(null);

function ActionButton({ a, kind }: { a: HeaderAction; kind: "primary" | "secondary" }) {
  const cls = btn(kind);
  if (a.href && !a.disabled) {
    return (
      <Link href={a.href} className={cls} title={a.title}>
        {a.icon}
        {a.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={a.onClick} disabled={a.disabled} title={a.title} className={cls}>
      {a.icon}
      {a.label}
    </button>
  );
}

export function PageHeader({
  title,
  titleExtra,
  subtitle,
  status,
  actions = [],
  primary,
  menu = [],
  menuLabel,
}: {
  title: ReactNode;
  /** Right after the title: the "?" of a page's help. */
  titleExtra?: ReactNode;
  /** One line of numbers: "1,224 products · 659 this month". */
  subtitle?: ReactNode;
  /** A run in progress, beside the buttons: "Packing 3.2 MB…". */
  status?: ReactNode;
  /** Outlined buttons, two at most; under "…" on a phone. */
  actions?: HeaderAction[];
  /** The one main action. */
  primary?: HeaderAction;
  /** Everything else, under "…". */
  menu?: MenuItem[];
  /** Names the "…" (default "More actions"). */
  menuLabel?: string;
}) {
  const t = useT();
  const router = useRouter();
  const slot = useContext(PinnedActionSlot);
  const label = menuLabel ?? t("menu.more");

  const asItem = (a: HeaderAction): MenuItem => ({
    label: a.label,
    onSelect: a.href ? () => router.push(a.href!) : (a.onClick ?? (() => {})),
    disabled: a.disabled,
  });
  const phoneMenu: MenuItem[] = [
    ...actions.map(asItem),
    ...(actions.length > 0 && menu.length > 0 ? [{ kind: "separator" as const }] : []),
    ...menu,
  ];

  return (
    <header className="flex items-start md:items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[22px] leading-7 md:text-2xl font-light text-[var(--foreground)]">{title}</h1>
          {titleExtra}
        </div>
        {subtitle && <p className="text-[13px] text-[var(--foreground-muted)] mt-1">{subtitle}</p>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {status && (
          <span role="status" className="text-[12px] text-[var(--foreground-muted)] tabular-nums">
            {status}
          </span>
        )}
        <div className="hidden md:flex items-center gap-2">
          {actions.map((a) => (
            <ActionButton key={a.key} a={a} kind="secondary" />
          ))}
          {primary && <ActionButton a={primary} kind="primary" />}
          {menu.length > 0 && <RowMenu label={label} outline items={menu} />}
        </div>
        {phoneMenu.length > 0 && (
          <div className="md:hidden">
            <RowMenu label={label} outline items={phoneMenu} />
          </div>
        )}
      </div>
      {primary &&
        slot &&
        createPortal(
          // The page's last screen of rows scrolls up from under the fade.
          <div className="[body:has([data-bulk-bar])_&]:hidden px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-linear-to-t from-[var(--background)] from-70% to-transparent">
            {primary.href && !primary.disabled ? (
              <Link href={primary.href} className={`${btn("primary", "lg")} w-full`}>
                {primary.icon}
                {primary.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={primary.onClick}
                disabled={primary.disabled}
                title={primary.title}
                className={`${btn("primary", "lg")} w-full`}
              >
                {primary.icon}
                {primary.label}
              </button>
            )}
          </div>,
          slot
        )}
    </header>
  );
}
