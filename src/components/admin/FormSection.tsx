import type { ReactNode } from "react";

/*
 * A form in sections (docs/ADMIN_DESIGN.md 5.11, GS4-5): each section names
 * itself on the left — the title and a line or two of what it is for — and
 * holds its fields on the right. That line replaces the paragraphs of
 * explanation Settings, Retailers and AI check opened with.
 *
 *   <FormPanel>
 *     <FormSection id="keys" title="API keys" description="Stored in the database.">…</FormSection>
 *     <FormSection id="embeddings" title="Embeddings">…</FormSection>
 *   </FormPanel>
 *
 * Side by side once the section is wide enough for both (a container query),
 * stacked on a phone. Saving is the page's one SaveBar, not a button per section.
 */

export function FormPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]" style={{ background: "var(--surface)" }}>
      {children}
    </div>
  );
}

export function FormSection({
  id,
  title,
  description,
  extra,
  children,
}: {
  /** The anchor the page's section menu links to. */
  id: string;
  title: string;
  description?: ReactNode;
  /** Beside the title: a "?" (HelpButton), a status badge. */
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="@container scroll-mt-6">
      <div className="grid gap-x-6 gap-y-4 p-4 md:p-6 @2xl:grid-cols-[240px_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 id={`${id}-title`} className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">
              {title}
            </h2>
            {extra}
          </div>
          {description && <div className="mt-1 text-[12px] leading-[18px] text-[var(--foreground-muted)]">{description}</div>}
        </div>
        <div className="min-w-0 flex flex-col gap-3">{children}</div>
      </div>
    </section>
  );
}
