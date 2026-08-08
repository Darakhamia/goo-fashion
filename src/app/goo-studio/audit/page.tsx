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
 * checks that are exact are marked as such; the rest are suggestions.
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
}

interface AuditReport {
  catalogue: { products: number; category_tree: string };
  totals: Record<string, number>;
  suspects: Record<string, Suspect[]>;
}

/** Section copy: what the check is, and how much it can be trusted. */
const SECTIONS: { key: string; title: string; note: string; exact?: boolean }[] = [
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

/** Fields this page can write. Anything else is for the product editor. */
const APPLIABLE = new Set(["category", "subcategory", "gender", "colour group"]);

export default function AdminAuditPage() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/label-audit?limit=300", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not run the audit.");
        setReport(null);
      } else {
        setReport(json);
        setDone(new Set());
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const apply = async (s: Suspect) => {
    const key = `${s.field}:${s.id}`;
    setBusyId(key);
    try {
      const res = await fetch("/api/admin/label-audit/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, field: s.field, value: s.suggested }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Could not apply.", "err");
        return;
      }
      // Struck through in place rather than removed: seeing what was just
      // changed is the point, and a list that reshuffles under the cursor is
      // hard to work through.
      setDone((prev) => new Set(prev).add(key));
      showToast(`${s.name.slice(0, 40)} → ${s.suggested}`);
    } catch {
      showToast("Could not reach the server.", "err");
    } finally {
      setBusyId(null);
    }
  };

  const total = report ? Object.values(report.totals).reduce((n, v) => n + v, 0) : 0;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Audit</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
            {report
              ? `${total} thing${total === 1 ? "" : "s"} worth a second look across ${report.catalogue.products} products`
              : "Checking the catalogue's labelling…"}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 border border-[var(--border)] rounded-lg px-3 py-2 text-[11px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40"
        >
          {loading ? "Checking…" : "Re-check"}
        </button>
      </div>

      {error && (
        <div className="mb-6 border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-600">{error}</div>
      )}

      {loading && !report && (
        <div className="px-6 py-16 text-center text-xs text-[var(--foreground-muted)] tracking-wide">
          Running the checks…
        </div>
      )}

      {report && total === 0 && (
        <div className="rounded-xl border border-[var(--border)] px-6 py-16 text-center" style={{ background: "var(--background)" }}>
          <p className="text-sm text-[var(--foreground)]">Nothing to flag.</p>
          <p className="text-xs text-[var(--foreground-muted)] mt-2">
            Every subcategory sits in the tree, no category contradicts one, and no name argues with its label.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {report &&
          SECTIONS.map(({ key, title, note, exact }) => {
            const list = report.suspects[key] ?? [];
            if (!list.length) return null;
            return (
              <section key={key} className="rounded-xl border border-[var(--border)]" style={{ background: "var(--background)" }}>
                <header className="px-5 py-3.5 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm text-[var(--foreground)]">{title}</h2>
                    <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">
                      {report.totals[key]}
                    </span>
                    {exact && (
                      <span className="text-[9px] tracking-[0.1em] uppercase border border-[var(--border)] rounded-full px-2 py-0.5 text-[var(--foreground-muted)]">
                        exact
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--foreground-muted)] mt-1 leading-relaxed max-w-3xl">{note}</p>
                </header>

                <ul>
                  {list.map((s) => {
                    const rowKey = `${s.field}:${s.id}`;
                    const applied = done.has(rowKey);
                    const canApply = APPLIABLE.has(s.field) && s.suggested && s.suggested !== "—";
                    return (
                      <li
                        key={rowKey}
                        className={`px-5 py-3 border-b border-[var(--border)] last:border-b-0 flex items-start justify-between gap-4 ${applied ? "opacity-45" : "hover:bg-[var(--surface)]"} transition-colors`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/goo-studio/products?search=${encodeURIComponent(s.name)}`}
                              className={`text-sm text-[var(--foreground)] hover:underline ${applied ? "line-through" : ""}`}
                            >
                              {s.name || "(no name)"}
                            </Link>
                            {s.agreement > 1 && (
                              <span className="text-[9px] tracking-[0.1em] uppercase bg-[var(--foreground)] text-[var(--background)] rounded-full px-1.5 py-0.5">
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

                        <div className="shrink-0 pt-0.5">
                          {applied ? (
                            <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)]">Applied</span>
                          ) : canApply ? (
                            <button
                              onClick={() => apply(s)}
                              disabled={busyId === rowKey}
                              className="border border-[var(--foreground)] text-[var(--foreground)] px-3 py-1.5 text-[10px] tracking-[0.12em] uppercase hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors disabled:opacity-40"
                            >
                              {busyId === rowKey ? "…" : "Apply"}
                            </button>
                          ) : (
                            <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">Edit by hand</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
      </div>

      {report && (
        <p className="mt-6 text-[11px] text-[var(--foreground-muted)] leading-relaxed max-w-3xl">
          A suggestion is not a verdict: where a rule disagrees with a label, either one of them can be the wrong one —
          a piece genuinely called &ldquo;Low Rise&rdquo; will be argued at by a rule that learned &ldquo;low&rdquo; from
          sneakers. Fixing a subcategory sets the category with it, since the tree already says where the label belongs.
          Re-check after a run of edits to see what is left.
        </p>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 text-xs tracking-wide shadow-lg rounded-xl ${
          toast.type === "ok" ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
