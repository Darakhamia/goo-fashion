"use client";

/**
 * Audit — the products whose labels look wrong, and one click each to fix them.
 *
 * The catalogue's own labelling is the standard everything else is measured
 * against, so a mistake in it spreads: a hoodie filed as footwear teaches the
 * classifier that hoodies are shoes. This page is where those get found.
 *
 * Corrections are one product at a time, against visible evidence. A rule
 * disagreeing with a label means one of the two is wrong, and which one is a
 * judgement — so there is no "apply all" here, and there should not be. The
 * checks that are exact are marked as such; the rest are suggestions. The one
 * exception is a colour that is a size or a file name: that is never a matter
 * of judgement, and an import can leave a whole store of them, so that section
 * can be applied at once — still one checked write per product.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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

/** One suggestion, keyed exactly as the API keys a dismissal. */
function claimKey(s: Suspect): string {
  return [s.id, s.field, s.stored, s.suggested].join("\u0000");
}

/**
 * What an Apply settles. A single-valued field holds one answer, so applying
 * any suggestion for it settles the others for that product too; a colour
 * group is added alongside the rest, so it settles only its own suggestion.
 */
function appliedKey(s: Suspect): string {
  return s.field === "colour group" ? claimKey(s) : `${s.field}:${s.id}`;
}

/** Section copy: what the check is, and how much it can be trusted. */
const SECTIONS: { key: string; title: string; note: string; exact?: boolean; bulk?: boolean }[] = [
  {
    key: "colour_label_not_a_colour",
    title: "Colour that is not a colour",
    note: "The colour label is a size or a file name — a size row built from swatches reads to the importer like the picked colour. Applying replaces it with the colourway the name ends with (“Mia Jacket - Beige/White”), or the colour the name mentions, or clears it.",
    exact: true,
    bulk: true,
  },
  {
    key: "subcategory_not_in_tree",
    title: "Subcategory that no longer exists",
    note: "The label is not in the category tree at all — usually left behind by an edit under Categories. Pick a new one in the product editor.",
    exact: true,
  },
  {
    key: "category_contradicts_subcategory",
    title: "Category contradicts the subcategory",
    note: "The tree files this subcategory under a different category. Wrong by definition, not by guesswork.",
    exact: true,
  },
  {
    key: "filed_under_the_wrong_group",
    title: "The name says a different kind of thing",
    note: "A t-shirt among the watches, or filed as knitwear. Its category and subcategory agree with each other, so the checks below stay quiet about it — only its own name gives it away. The subcategory is what has to change, so fix it in the product editor and the category will follow.",
  },
  {
    key: "subcategory_named_in_the_name",
    title: "The name names a different subcategory",
    note: "The name says one thing and the label says another — a piece called “T-Shirt” filed as Hoodies. Both may sit in the same category, which is why nothing else notices. Where a name mentions two, the more specific one wins, so a “Long Sleeve T-Shirt” is read as Long Sleeves. Applying sets the category to match.",
    exact: true,
  },
  {
    key: "same_phrase_filed_two_ways",
    title: "Filed differently from its near-identical siblings",
    note: "The catalogue disagreeing with itself: this piece's name matches a phrase that is filed the other way almost every time.",
  },
  {
    key: "category_disputed_by_name",
    title: "Category disputed by the name",
    note: "The product's own name argues for a different category. Two mechanisms agreeing is marked ×2 and is worth looking at first.",
  },
  {
    key: "subcategory_disputed_by_name",
    title: "Subcategory disputed by the name",
    note: "Applying this sets the category to match, since the tree already says where the label belongs.",
  },
  { key: "gender_disputed_by_name", title: "Gender disputed by the name", note: "The name or description names a different gender." },
  {
    key: "colour_group_possibly_missing",
    title: "Colour filter possibly missing",
    note: "A colour this piece has is reliably filed under a group it does not carry, so it may be invisible to that colour filter. Applying adds the group without removing any.",
  },
];

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
function sectionsToRender(report: AuditReport) {
  const known = new Set(SECTIONS.map((s) => s.key));
  const extra = Object.keys(report.suspects)
    .filter((key) => !known.has(key))
    .map((key) => ({ key, title: fallbackTitle(key), note: "", exact: false, bulk: false }));
  return [...SECTIONS, ...extra];
}

/** Fields this page can write. Anything else is for the product editor. */
const APPLIABLE = new Set(["category", "subcategory", "gender", "colour group", "colour"]);

/** Findings listed per section; the rest are counted, and said to be. */
const LIMIT = 300;

export default function AdminAuditPage() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => setToast({ msg, type });

  // One timer per toast, so a second action's toast is not cut short by the first's.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/label-audit?limit=${LIMIT}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not run the audit.");
        setReport(null);
      } else {
        setReport(json);
        setDone(new Set());
        setHidden(new Set());
      }
    } catch {
      setError("Could not reach the server.");
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
      if (!res.ok) return json.error ?? "Could not apply.";
      // Struck through in place rather than removed: seeing what was just
      // changed is the point, and a list that reshuffles under the cursor is
      // hard to work through.
      setDone((prev) => new Set(prev).add(appliedKey(s)));
      return null;
    } catch {
      return "Could not reach the server.";
    }
  };

  const apply = async (s: Suspect) => {
    setBusyKey(claimKey(s));
    const failed = await applyOne(s);
    setBusyKey(null);
    showToast(failed ?? `${s.name.slice(0, 40)} → ${s.suggested}`, failed ? "err" : "ok");
  };

  /** A whole exact section, one product after another. */
  const applyAll = async (key: string, list: Suspect[]) => {
    const todo = list.filter((s) => !s.dismissed && !done.has(appliedKey(s)) && !hidden.has(claimKey(s)));
    if (!todo.length) return;
    if (!confirm(`Apply ${todo.length} fix${todo.length === 1 ? "" : "es"} in this section? Each product is written separately.`)) return;
    setBusyKey(`section:${key}`);
    let fixed = 0;
    let refused = 0;
    for (const s of todo) {
      if (await applyOne(s)) refused++;
      else fixed++;
    }
    setBusyKey(null);
    showToast(
      refused ? `Fixed ${fixed}; ${refused} refused — re-check to see why` : `Fixed ${fixed}`,
      refused ? "err" : "ok",
    );
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
        showToast(
          json.code === "TABLE_MISSING"
            ? "Dismissals need migration 012 — run it in Supabase first."
            : json.error ?? "Could not dismiss.",
          "err",
        );
        return;
      }
      // Hidden rather than removed, so the row stays where it was until the
      // next re-check and the list does not jump under the cursor.
      setHidden((prev) => new Set(prev).add(key));
      showToast(`Dismissed — "${s.stored} → ${s.suggested}" won't be raised again`);
    } catch {
      showToast("Could not reach the server.", "err");
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
        showToast(json.error ?? "Could not restore.", "err");
        return;
      }
      setHidden((prev) => new Set(prev).add(key));
      showToast("Restored — it will be raised again on the next check.");
    } catch {
      showToast("Could not reach the server.", "err");
    } finally {
      setBusyKey(null);
    }
  };

  // Open findings only: the API counts dismissed ones apart.
  const total = report ? Object.values(report.totals).reduce((n, v) => n + v, 0) : 0;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Audit</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
            {report
              ? `${total} thing${total === 1 ? "" : "s"} worth a second look across ${report.catalogue.products} products`
              : "Checking the catalogue's labelling…"}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => setShowDismissed((v) => !v)}
            disabled={!report}
            aria-pressed={showDismissed}
            title="Suggestions you rejected. Shown so a dismissal can be undone."
            className={`border rounded-lg px-3 py-2 text-[11px] tracking-[0.1em] uppercase transition-colors disabled:opacity-40 ${
              showDismissed
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                : "border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
            }`}
          >
            Dismissed{report ? ` (${report.dismissed})` : ""}
          </button>
          <button
            onClick={() => load()}
            disabled={loading}
            className="border border-[var(--border)] rounded-lg px-3 py-2 text-[11px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40"
          >
            {loading ? "Checking…" : "Re-check"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-3 text-xs text-[var(--err)]">{error}</div>
      )}

      {report && !report.dismissalsAvailable && (
        <div className="mb-6 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3">
          <p className="text-[13px] text-[var(--warn)] leading-relaxed">
            Dismiss cannot be remembered until supabase/migrations/012_label_audit_dismissals.sql is run. Applying
            works without it.
          </p>
        </div>
      )}

      {report?.dismissalsError && (
        <div className="mb-6 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3">
          <p className="text-[13px] text-[var(--warn)] leading-relaxed">
            Could not read the dismissed suggestions, so ones you dismissed are listed again: {report.dismissalsError}
          </p>
        </div>
      )}

      {loading && !report && (
        <div className="px-6 py-16 text-center text-xs text-[var(--foreground-muted)] tracking-wide">
          Running the checks…
        </div>
      )}

      {report && total === 0 && !(showDismissed && report.dismissed > 0) && (
        <div className="rounded-xl border border-[var(--border)] px-6 py-16 text-center" style={{ background: "var(--surface)" }}>
          <p className="text-sm text-[var(--foreground)]">Nothing to flag.</p>
          <p className="text-xs text-[var(--foreground-muted)] mt-2">
            Every subcategory sits in the tree, no category contradicts one, and no name argues with its label.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {report &&
          sectionsToRender(report).map(({ key, title, note, exact, bulk }) => {
            // Dismissed ones arrive with every run and are only shown or hidden here.
            const all = report.suspects[key] ?? [];
            const list = showDismissed ? all : all.filter((s) => !s.dismissed);
            if (!list.length) return null;
            const openTotal = report.totals[key] ?? 0;
            const dismissedTotal = report.dismissedTotals?.[key] ?? 0;
            const openShown = all.filter((s) => !s.dismissed).length;
            const dismissedShown = all.length - openShown;
            const cut: string[] = [];
            if (openTotal > openShown) cut.push(`showing ${openShown} of ${openTotal}`);
            if (showDismissed && dismissedTotal > dismissedShown) {
              cut.push(`showing ${dismissedShown} of ${dismissedTotal} dismissed`);
            }
            const open = all.filter((s) => !s.dismissed && !done.has(appliedKey(s)) && !hidden.has(claimKey(s))).length;
            return (
              <section key={key} className="rounded-xl border border-[var(--border)]" style={{ background: "var(--surface)" }}>
                <header className="px-5 py-3.5 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm text-[var(--foreground)]">{title}</h2>
                    <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">
                      {openTotal}
                      {showDismissed && dismissedTotal > 0 ? ` · ${dismissedTotal} dismissed` : ""}
                    </span>
                    {exact && (
                      <span className="text-[9px] tracking-[0.1em] uppercase border border-[var(--border)] rounded-full px-2 py-0.5 text-[var(--foreground-muted)]">
                        exact
                      </span>
                    )}
                    {bulk && open > 0 && (
                      <button
                        onClick={() => applyAll(key, list)}
                        disabled={busyKey !== null}
                        className="ml-auto shrink-0 whitespace-nowrap bg-[var(--foreground)] text-[var(--surface)] px-3 py-1.5 rounded-lg text-[10px] tracking-[0.12em] uppercase hover:opacity-80 transition-opacity disabled:opacity-40"
                      >
                        {busyKey === `section:${key}` ? "Fixing…" : `Apply all ${open}`}
                      </button>
                    )}
                  </div>
                  {note && <p className="text-[11px] text-[var(--foreground-muted)] mt-1 leading-relaxed max-w-3xl">{note}</p>}
                </header>

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
                              {s.name || "(no name)"}
                            </Link>
                            {s.agreement > 1 && (
                              <span className="text-[9px] tracking-[0.1em] uppercase bg-[var(--foreground)] text-[var(--surface)] rounded-full px-1.5 py-0.5">
                                ×{s.agreement}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                            <span className="uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">{s.field}</span>{" "}
                            <span className="font-mono">{s.stored || "(none)"}</span>
                            {canApply && <> → <span className="font-mono text-[var(--foreground)]">{s.suggested}</span></>}
                          </p>
                          {s.evidence.map((e, i) => (
                            <p key={i} className="text-[10px] text-[var(--foreground-subtle)] mt-0.5 leading-relaxed">
                              {e}
                            </p>
                          ))}
                        </div>

                        <div className="shrink-0 pt-0.5 flex items-center gap-3">
                          {applied ? (
                            <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)]">Applied</span>
                          ) : gone ? (
                            <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)]">
                              {s.dismissed ? "Restored" : "Dismissed"}
                            </span>
                          ) : (
                            <>
                              {canApply && !s.dismissed && (
                                <button
                                  onClick={() => apply(s)}
                                  disabled={busyKey === rowKey}
                                  className="bg-[var(--foreground)] text-[var(--surface)] px-3 py-1.5 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40"
                                >
                                  {busyKey === rowKey ? "…" : "Apply"}
                                </button>
                              )}
                              {!canApply && !s.dismissed && (
                                <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">Edit by hand</span>
                              )}
                              <button
                                onClick={() => (s.dismissed ? restore(s) : dismiss(s))}
                                disabled={busyKey === rowKey}
                                title={
                                  s.dismissed
                                    ? "Raise this again on future checks"
                                    : "This suggestion is wrong — stop raising it"
                                }
                                className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
                              >
                                {s.dismissed ? "Restore" : "Dismiss"}
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
                    {cut.join(" · ")} — work through these and re-check to see the rest.
                  </p>
                )}
              </section>
            );
          })}
      </div>

      {report && (
        <p className="mt-6 text-[11px] text-[var(--foreground-muted)] leading-relaxed max-w-3xl">
          A suggestion is not a verdict: where a rule disagrees with a label, either one of them can be the wrong one —
          a piece genuinely called &ldquo;Low Rise&rdquo; will be argued at by a rule that learned &ldquo;low&rdquo; from
          sneakers. Fixing a subcategory sets the category with it, since the tree already says where the label belongs.
          Re-check after a run of edits to see what is left. &ldquo;Fix categories&rdquo; on Products applies the same
          keyword table in bulk, but only to products with no subcategory.
        </p>
      )}

      {toast && (
        <div
          role={toast.type === "ok" ? "status" : "alert"}
          className={`fixed bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 z-50 px-4 py-3 text-xs tracking-wide rounded-xl border ${
            toast.type === "ok"
              ? "bg-[var(--foreground)] text-[var(--surface)] border-[var(--foreground)]"
              : "bg-[var(--surface)] text-[var(--err)] border-[var(--err-line)]"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
