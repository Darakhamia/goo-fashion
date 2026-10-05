"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/*
 * The two page layouts of goo-studio (GS4-5). A page never sets its own root
 * width; it picks one of these. The shell caps every page at 1600px.
 *
 * - "list" — tables and boards: the full width.
 * - "form" — settings and editors: a column of at most 960px, which fits a
 *   FormSection's 240px title beside its fields (the Settings mockup), with an
 *   optional section menu on the left (`nav`, 200px) and a side column on the
 *   right (`aside`, 320px: a preview, a summary). Both go under the column on
 *   narrow screens.
 */

export function AdminPage({
  layout = "list",
  nav,
  aside,
  children,
}: {
  layout?: "list" | "form";
  nav?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  if (layout === "list") return <div className="min-w-0">{children}</div>;
  const cols = nav
    ? aside
      ? "lg:grid-cols-[200px_minmax(0,960px)] 2xl:grid-cols-[200px_minmax(0,960px)_320px]"
      : "lg:grid-cols-[200px_minmax(0,960px)]"
    : aside
      ? "xl:grid-cols-[minmax(0,960px)_320px]"
      : "";
  return (
    <div className={`grid gap-6 lg:gap-8 items-start ${cols}`}>
      {/* The section menu from lg; on a phone the sections are one scroll. */}
      {nav && <div className="hidden lg:block min-w-0 lg:sticky lg:top-4">{nav}</div>}
      <div className="min-w-0 max-w-[960px]">{children}</div>
      {aside && <div className={`min-w-0 ${nav ? "lg:col-start-2 2xl:col-start-auto" : ""}`}>{aside}</div>}
    </div>
  );
}

/**
 * The section menu of a form page ("Database · API keys · Embeddings"): links
 * to the FormSections below. The current one is the caller's to know.
 */
export function SectionNav({
  label,
  items,
  current,
}: {
  label: string;
  items: { id: string; label: string; badge?: ReactNode }[];
  current?: string;
}) {
  return (
    <nav aria-label={label} className="flex lg:flex-col gap-0.5 overflow-x-auto -mx-1 px-1 lg:mx-0 lg:px-0">
      {items.map((it) => {
        const on = it.id === current;
        return (
          <a
            key={it.id}
            href={`#${it.id}`}
            aria-current={on ? "location" : undefined}
            className={`flex flex-shrink-0 items-center gap-2 h-8 px-2.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
              on
                ? "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]"
                : "text-[var(--foreground-muted)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]"
            }`}
          >
            <span className="flex-1">{it.label}</span>
            {it.badge}
          </a>
        );
      })}
    </nav>
  );
}

/**
 * Which of the sections `ids` is being read: the first one crossing the upper
 * part of the screen. For the section menu's current item.
 */
export function useScrollSpy(ids: string[]): string | undefined {
  const [current, setCurrent] = useState<string | undefined>(ids[0]);
  const key = ids.join(",");
  useEffect(() => {
    const order = key.split(",");
    const els = order.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const inView = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) inView.set(e.target.id, e.isIntersecting);
        const first = order.find((id) => inView.get(id));
        if (first) setCurrent(first);
      },
      { rootMargin: "-10% 0px -60% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [key]);
  return current;
}
