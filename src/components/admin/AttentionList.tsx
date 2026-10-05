"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { btn } from "@/app/goo-studio/_ui/recipes";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useFormat, useT } from "@/app/goo-studio/_i18n";
import { Badge } from "./Badge";

/*
 * "Needs attention" (docs/ADMIN_DESIGN.md 5.5, GS1-2): what is broken or waits
 * for a person, most serious first.
 *
 *   Needs attention (4)
 *   ● 12 database migrations are not applied      How to fix ▾  [Open Settings]
 *     Until they run, some saves quietly drop fields…
 *
 * A row: the importance dot (err, warn), a 13px title, one line of what it
 * means, and the way to the section that fixes it. "How to fix" folds out the
 * developer's part — a cron line, migration files — as code. Nothing to show
 * is said too: "All good", with a tick.
 *
 * On a phone (mockup "Phone · Dashboard") a row is one link to its section,
 * with a chevron: the buttons and the developer's part stay on a computer.
 *
 * The dashboard shows everything; a section page can show only its own items,
 * in place of its own banners.
 */

export type AttentionRow = {
  key: string;
  tone: "err" | "warn";
  title: ReactNode;
  text?: ReactNode;
  action?: { label: string; href: string };
  /** Lines for the developer, shown as code under "How to fix". */
  fix?: string[];
};

function Dot({ tone }: { tone: AttentionRow["tone"] }) {
  return <span aria-hidden="true" className={`w-2 h-2 flex-shrink-0 rounded-full ${tone === "err" ? "bg-[var(--err)]" : "bg-[var(--warn)]"}`} />;
}

function PhoneRow({ row, first }: { row: AttentionRow; first: boolean }) {
  const body = (
    <>
      <Dot tone={row.tone} />
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] leading-[18px] font-medium text-[var(--foreground)]">{row.title}</span>
        {row.text && <span className="block text-[12px] leading-[17px] text-[var(--foreground-muted)]">{row.text}</span>}
      </span>
    </>
  );
  const cls = "flex items-center gap-2.5 min-h-[52px] pl-4 pr-3 py-2.5";
  return (
    <li className={first ? "" : "border-t border-[var(--border)]"}>
      {row.action ? (
        <Link href={row.action.href} className={`${cls} active:bg-[var(--fg-overlay-05)]`}>
          {body}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="flex-shrink-0 text-[var(--foreground-muted)]">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

function Row({ row, first }: { row: AttentionRow; first: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const fixId = useId();
  return (
    <li className={first ? "" : "border-t border-[var(--border)]"}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 md:px-5 py-3.5">
        <Dot tone={row.tone} />
        <div className="flex-[1_1_320px] min-w-0">
          <div className="text-[13px] leading-5 font-medium text-[var(--foreground)]">{row.title}</div>
          {row.text && <div className="text-[12px] leading-[18px] text-[var(--foreground-muted)]">{row.text}</div>}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {row.fix && row.fix.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={fixId}
              className={btn("ghost")}
            >
              {t("attn.howToFix")}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {row.action && (
            <Link href={row.action.href} className={btn("secondary")}>
              {row.action.label}
            </Link>
          )}
        </div>
      </div>
      {row.fix && open && (
        <pre
          id={fixId}
          className="mx-4 md:mx-5 mb-3.5 px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[12px] leading-[18px] font-mono text-[var(--foreground)] whitespace-pre-wrap break-all"
        >
          {row.fix.join("\n")}
        </pre>
      )}
    </li>
  );
}

export function AttentionList({ rows, loading = false }: { rows: AttentionRow[]; loading?: boolean }) {
  const t = useT();
  const f = useFormat();
  const phone = useMediaQuery("(width < 48rem)");
  const worst = rows.some((r) => r.tone === "err") ? "err" : "warn";
  return (
    // Named by its text, not by an id: the panel is in the server's first
    // paint, where useId and the browser's ids need not agree in dev.
    <section aria-label={t("attn.title")} className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
      <div className="flex items-center gap-2 px-4 md:px-5 py-3.5 border-b border-[var(--border)]">
        <h2 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">
          {t("attn.title")}
        </h2>
        {rows.length > 0 && <Badge tone={worst}>{f.number(rows.length)}</Badge>}
      </div>
      {loading ? (
        <p className="px-4 md:px-5 py-4 text-[13px] text-[var(--foreground-muted)]">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="flex items-center gap-2 px-4 md:px-5 py-4 text-[13px] text-[var(--foreground)]">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="text-[var(--ok)]">
            <path d="M2.5 6.5L5 9l4.5-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("attn.allGood")}
        </p>
      ) : (
        <ul>
          {rows.map((r, i) => (phone ? <PhoneRow key={r.key} row={r} first={i === 0} /> : <Row key={r.key} row={r} first={i === 0} />))}
        </ul>
      )}
    </section>
  );
}
