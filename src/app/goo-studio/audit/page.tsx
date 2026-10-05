"use client";

/**
 * Audit — the products whose labels look wrong, and one click each to fix them.
 *
 * The catalog's own labeling is the standard everything else is measured
 * against, so a mistake in it spreads: a hoodie filed as footwear teaches the
 * classifier that hoodies are shoes. This page is where those get found.
 *
 * Corrections are one product at a time, against visible evidence. A rule
 * disagreeing with a label means one of the two is wrong, and which one is a
 * judgement — so there is no "apply all" here, and there should not be. The
 * checks that are exact are marked as such; the rest are suggestions. The one
 * exception is a color that is a size or a file name: that is never a matter
 * of judgement, and an import can leave a whole store of them, so that section
 * can be applied at once — still one checked write per product.
 */

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/admin/Badge";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { PageHeader } from "@/components/admin/PageHeader";
import { useToast } from "@/components/admin/Toast";
import { btn } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT, type Key, type T } from "@/app/goo-studio/_i18n";

interface Suspect {
  id: string;
  name: string;
  field: string;
  stored: string;
  suggested: string;
  evidence: string[];
  agreement: number;
  dismissed?: boolean;
}

interface AuditReport {
  catalogue: { products: number; category_tree: string };
  /** Open findings per section — dismissed ones are counted in `dismissedTotals`. */
  totals: Record<string, number>;
  dismissedTotals: Record<string, number>;
  /** Per section: open findings first, then dismissed ones marked `dismissed`. */
  suspects: Record<string, Suspect[]>;
  dismissed: number;
  /** False until migration 012 has run: Dismiss cannot be remembered yet. */
  dismissalsAvailable: boolean;
  /** Set when the dismissals could not be read, so dismissed claims are listed again. */
  dismissalsError: string | null;
}

/** The server's own message, or ours when it gave none. Kept as a key so the text follows the language switch. */
type Failure = { key: Key } | { text: string };

/** One suggestion, keyed exactly as the API keys a dismissal. */
function claimKey(s: Suspect): string {
  return [s.id, s.field, s.stored, s.suggested].join("\u0000");
}

/**
 * What an Apply settles. A single-valued field holds one answer, so applying
 * any suggestion for it settles the others for that product too; a color
 * group is added alongside the rest, so it settles only its own suggestion.
 */
function appliedKey(s: Suspect): string {
  return s.field === "colour group" ? claimKey(s) : `${s.field}:${s.id}`;
}

/** Section copy: what the check is, and how much it can be trusted. Keyed by the API's section key. */
const SECTIONS: { key: string; title: Key; note: Key; exact?: boolean; bulk?: boolean }[] = [
  {
    key: "colour_label_not_a_colour",
    title: "audit.check.colorNotColor.title",
    note: "audit.check.colorNotColor.note",
    exact: true,
    bulk: true,
  },
  { key: "subcategory_not_in_tree", title: "audit.check.subcategoryGone.title", note: "audit.check.subcategoryGone.note", exact: true },
  {
    key: "category_contradicts_subcategory",
    title: "audit.check.categoryContradicts.title",
    note: "audit.check.categoryContradicts.note",
    exact: true,
  },
  { key: "filed_under_the_wrong_group", title: "audit.check.wrongGroup.title", note: "audit.check.wrongGroup.note" },
  {
    key: "subcategory_named_in_the_name",
    title: "audit.check.nameNamesSubcategory.title",
    note: "audit.check.nameNamesSubcategory.note",
    exact: true,
  },
  { key: "same_phrase_filed_two_ways", title: "audit.check.siblingsDisagree.title", note: "audit.check.siblingsDisagree.note" },
  { key: "category_disputed_by_name", title: "audit.check.categoryDisputed.title", note: "audit.check.categoryDisputed.note" },
  { key: "subcategory_disputed_by_name", title: "audit.check.subcategoryDisputed.title", note: "audit.check.subcategoryDisputed.note" },
  { key: "gender_disputed_by_name", title: "audit.check.genderDisputed.title", note: "audit.check.genderDisputed.note" },
  { key: "colour_group_possibly_missing", title: "audit.check.colorGroupMissing.title", note: "audit.check.colorGroupMissing.note" },
];

/** The fields the API names, in words; any other shows as it came. */
const FIELD_LABEL: Record<string, Key> = {
  category: "audit.field.category",
  subcategory: "audit.field.subcategory",
  gender: "audit.field.gender",
  "colour group": "audit.field.colorGroup",
  colour: "audit.field.color",
};

/** Title for a section this page has no copy for, from its key. */
function fallbackTitle(key: string): string {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Known sections in their reading order, then anything else the audit reported.
 *
 * The page used to render a fixed list, so a section added to the API without
 * copy added here vanished from the list while still counting in the header.
 * Unknown is now merely unexplained, not invisible.
 */
function sectionsToRender(report: AuditReport, t: T) {
  const known = new Set(SECTIONS.map((s) => s.key));
  const extra = Object.keys(report.suspects)
    .filter((key) => !known.has(key))
    .map((key) => ({ key, title: fallbackTitle(key), note: "", exact: false, bulk: false }));
  return [...SECTIONS.map((s) => ({ ...s, title: t(s.title), note: t(s.note) })), ...extra];
}

/** Fields this page can write. Anything else is for the product editor. */
const APPLIABLE = new Set(["category", "subcategory", "gender", "colour group", "colour"]);

/** Findings listed per section; the rest are counted, and said to be. */
const LIMIT = 300;

/** A section's title row, with what the check is behind its "?". */
function SectionHeader({
  sectionKey,
  title,
  note,
  children,
}: {
  sectionKey: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  const t = useT();
  const help = useHelp(`audit-${sectionKey}`);
  return (
    <header className="px-5 py-3.5 border-b border-[var(--border)]">
      {/* Wraps on a phone: the longer Russian badge and "Apply all" do not fit one row there. */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm text-[var(--foreground)]">{title}</h2>
        {note && <HelpButton help={help} label={t("audit.section.about", { title })} />}
        {children}
      </div>
      {note && help.open && (
        <div className="mt-2">
          <HelpPanel help={help}>
            <p>{note}</p>
          </HelpPanel>
        </div>
      )}
    </header>
  );
}

export default function AdminAuditPage() {
  const t = useT();
  const f = useFormat();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Failure | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const help = useHelp("audit");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/label-audit?limit=${LIMIT}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ? { text: json.error } : { key: "audit.loadFailed" });
        setReport(null);
      } else {
        setReport(json);
        setDone(new Set());
        setHidden(new Set());
      }
    } catch {
      setError({ key: "audit.unreachable" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** One checked write; the error text when it was refused. */
  const applyOne = async (s: Suspect): Promise<string | null> => {
    try {
      const res = await fetch("/api/admin/label-audit/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, field: s.field, value: s.suggested }),
      });
      const json = await res.json();
      if (!res.ok) return json.error ?? t("audit.applyFailed");
      // Struck through in place rather than removed: seeing what was just
      // changed is the point, and a list that reshuffles under the cursor is
      // hard to work through.
      setDone((prev) => new Set(prev).add(appliedKey(s)));
      return null;
    } catch {
      return t("audit.unreachable");
    }
  };

  const apply = async (s: Suspect) => {
    setBusyKey(claimKey(s));
    const failed = await applyOne(s);
    setBusyKey(null);
    if (failed) toast.err(failed);
    else toast.ok(`${s.name.slice(0, 40)} → ${s.suggested}`);
  };

  /** A whole exact section, one product after another. */
  const applyAll = async (key: string, list: Suspect[]) => {
    const todo = list.filter((s) => !s.dismissed && !done.has(appliedKey(s)) && !hidden.has(claimKey(s)));
    if (!todo.length) return;
    if (
      !(await confirm({
        title: t("audit.confirm.title", { count: todo.length }),
        body: t("audit.confirm.body"),
        confirmLabel: t("audit.confirm.action", { count: todo.length }),
      }))
    )
      return;
    setBusyKey(`section:${key}`);
    let fixed = 0;
    let refused = 0;
    for (const s of todo) {
      if (await applyOne(s)) refused++;
      else fixed++;
    }
    setBusyKey(null);
    if (refused) toast.err(t("audit.fixedPartly", { fixed, refused }));
    else toast.ok(t("audit.fixed", { count: fixed }));
  };

  const claimBody = (s: Suspect) => ({
    id: s.id,
    field: s.field,
    stored: s.stored,
    suggested: s.suggested,
  });

  /** Rejects this suggestion for good, so re-running stops raising it. */
  const dismiss = async (s: Suspect) => {
    const key = claimKey(s);
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/label-audit/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimBody(s)),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.err(json.code === "TABLE_MISSING" ? t("audit.needsMigration") : json.error ?? t("audit.dismissFailed"));
        return;
      }
      // Hidden rather than removed, so the row stays where it was until the
      // next re-check and the list does not jump under the cursor.
      setHidden((prev) => new Set(prev).add(key));
      toast.ok(t("audit.dismissedToast", { stored: s.stored, suggested: s.suggested }));
    } catch {
      toast.err(t("audit.unreachable"));
    } finally {
      setBusyKey(null);
    }
  };

  const restore = async (s: Suspect) => {
    const key = claimKey(s);
    setBusyKey(key);
    try {
      const q = new URLSearchParams(claimBody(s)).toString();
      const res = await fetch(`/api/admin/label-audit/dismiss?${q}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.err(json.error ?? t("audit.restoreFailed"));
        return;
      }
      setHidden((prev) => new Set(prev).add(key));
      toast.ok(t("audit.restoredToast"));
    } catch {
      toast.err(t("audit.unreachable"));
    } finally {
      setBusyKey(null);
    }
  };

  // Open findings only: the API counts dismissed ones apart.
  const total = report ? Object.values(report.totals).reduce((n, v) => n + v, 0) : 0;

  return (
    <div>
      <PageHeader
        title={t("nav.audit")}
        titleExtra={<HelpButton help={help} label={t("audit.help.label")} />}
        subtitle={
          report
            ? [t("audit.summary.findings", { count: total }), t("audit.summary.products", { count: report.catalogue.products })].join(" · ")
            : loading
              ? t("audit.checking")
              : undefined
        }
        actions={[
          // Shows the suggestions dismissed before, in place, so a dismissal can be undone.
          {
            key: "dismissed",
            label: showDismissed
              ? t("audit.dismissed.hide")
              : report
                ? t("audit.dismissed.showCount", { count: report.dismissed })
                : t("audit.dismissed.show"),
            onClick: () => setShowDismissed((v) => !v),
            disabled: !report,
            title: t("audit.dismissed.hint"),
          },
          {
            key: "recheck",
            label: loading ? t("audit.checkingShort") : t("audit.recheck"),
            onClick: () => void load(),
            disabled: loading,
          },
        ]}
      />
      {help.open && (
        <div className="-mt-4 mb-6">
          <HelpPanel help={help}>
            <p>{t("audit.help.text")}</p>
          </HelpPanel>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-3 text-xs text-[var(--err)]">
          {"key" in error ? t(error.key) : error.text}
        </div>
      )}

      {report && !report.dismissalsAvailable && (
        <div className="mb-6 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3">
          <p className="text-[13px] text-[var(--warn)] leading-relaxed">{t("audit.migrationMissing")}</p>
        </div>
      )}

      {report?.dismissalsError && (
        <div className="mb-6 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3">
          <p className="text-[13px] text-[var(--warn)] leading-relaxed">
            {t("audit.dismissalsError", { error: report.dismissalsError })}
          </p>
        </div>
      )}

      {loading && !report && (
        <div className="px-6 py-16 text-center text-xs text-[var(--foreground-muted)] tracking-wide">{t("audit.running")}</div>
      )}

      {report && total === 0 && !(showDismissed && report.dismissed > 0) && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
          <p className="text-sm text-[var(--foreground)]">{t("audit.empty.title")}</p>
          <p className="text-xs text-[var(--foreground-muted)] mt-2">{t("audit.empty.text")}</p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {report &&
          sectionsToRender(report, t).map(({ key, title, note, exact, bulk }) => {
            // Dismissed ones arrive with every run and are only shown or hidden here.
            const all = report.suspects[key] ?? [];
            const list = showDismissed ? all : all.filter((s) => !s.dismissed);
            if (!list.length) return null;
            const openTotal = report.totals[key] ?? 0;
            const dismissedTotal = report.dismissedTotals?.[key] ?? 0;
            const openShown = all.filter((s) => !s.dismissed).length;
            const dismissedShown = all.length - openShown;
            const cut: string[] = [];
            if (openTotal > openShown) cut.push(t("audit.cut.open", { shown: openShown, total: openTotal }));
            if (showDismissed && dismissedTotal > dismissedShown) {
              cut.push(t("audit.cut.dismissed", { shown: dismissedShown, total: dismissedTotal }));
            }
            const open = all.filter((s) => !s.dismissed && !done.has(appliedKey(s)) && !hidden.has(claimKey(s))).length;
            return (
              <section key={key} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <SectionHeader sectionKey={key} title={title} note={note}>
                  <span className="text-[12px] text-[var(--foreground-muted)] tabular-nums">
                    {f.number(openTotal)}
                    {showDismissed && dismissedTotal > 0 ? ` · ${t("audit.section.dismissedCount", { count: dismissedTotal })}` : ""}
                  </span>
                  {exact && <Badge>{t("audit.exact")}</Badge>}
                  {bulk && open > 0 && (
                    <button
                      onClick={() => applyAll(key, list)}
                      disabled={busyKey !== null}
                      className={`${btn("primary")} ml-auto shrink-0`}
                    >
                      {busyKey === `section:${key}` ? t("audit.fixing") : t("audit.applyAll", { count: open })}
                    </button>
                  )}
                </SectionHeader>

                <ul>
                  {list.map((s, i) => {
                    // The whole suggestion, not "field + product": one product
                    // can carry two suggestions, and acting on one must not
                    // mark the other.
                    const rowKey = claimKey(s);
                    const applied = !s.dismissed && done.has(appliedKey(s));
                    const gone = hidden.has(rowKey);
                    const faded = applied || gone || s.dismissed;
                    const canApply = APPLIABLE.has(s.field) && s.suggested && s.suggested !== "—";
                    return (
                      <li
                        key={`${rowKey}\u0000${i}`}
                        className={`px-5 py-3 border-b border-[var(--border)] last:border-b-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 ${faded ? "opacity-45" : "hover:bg-[var(--background)]"} transition-colors`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/goo-studio/products?search=${encodeURIComponent(s.name)}`}
                              className={`text-sm text-[var(--foreground)] hover:underline ${applied || gone ? "line-through" : ""}`}
                            >
                              {s.name || t("audit.noName")}
                            </Link>
                            {s.agreement > 1 && <Badge tone="inverse">×{s.agreement}</Badge>}
                          </div>
                          <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                            <span className="font-medium">{FIELD_LABEL[s.field] ? t(FIELD_LABEL[s.field]) : s.field}</span>{" "}
                            <span className="font-mono">{s.stored || t("audit.none")}</span>
                            {canApply && <> → <span className="font-mono text-[var(--foreground)]">{s.suggested}</span></>}
                          </p>
                          {s.evidence.map((e, i) => (
                            <p key={i} className="text-[12px] text-[var(--foreground-subtle)] mt-0.5 leading-relaxed">
                              {e}
                            </p>
                          ))}
                        </div>

                        <div className="shrink-0 pt-0.5 flex items-center gap-3">
                          {applied ? (
                            <span className="text-[11px] font-medium text-[var(--foreground-muted)]">{t("audit.applied")}</span>
                          ) : gone ? (
                            <span className="text-[11px] font-medium text-[var(--foreground-muted)]">
                              {s.dismissed ? t("audit.restored") : t("audit.dismissed")}
                            </span>
                          ) : (
                            <>
                              {canApply && !s.dismissed && (
                                <button
                                  onClick={() => apply(s)}
                                  disabled={busyKey === rowKey}
                                  className={btn("secondary", "sm")}
                                >
                                  {busyKey === rowKey ? "…" : t("audit.apply")}
                                </button>
                              )}
                              {!canApply && !s.dismissed && (
                                <Link
                                  href={`/goo-studio/products?search=${encodeURIComponent(s.name)}`}
                                  className={btn("ghost", "sm")}
                                >
                                  {t("audit.editByHand")}
                                </Link>
                              )}
                              <button
                                onClick={() => (s.dismissed ? restore(s) : dismiss(s))}
                                disabled={busyKey === rowKey}
                                title={s.dismissed ? t("audit.restoreHint") : t("audit.dismissHint")}
                                className={btn("ghost", "sm")}
                              >
                                {s.dismissed ? t("audit.restore") : t("audit.dismiss")}
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {cut.length > 0 && (
                  <p className="px-5 py-3 border-t border-[var(--border)] text-[11px] text-[var(--foreground-muted)]">
                    {t("audit.cut.tail", { list: cut.join(" · ") })}
                  </p>
                )}
              </section>
            );
          })}
      </div>
    </div>
  );
}
