"use client";

/**
 * Duplicates — the same item held as more than one card, and one click to make
 * it one card with every place to buy it.
 *
 * The finder applies the importer's own same-item test to the whole catalogue
 * (`lib/server/duplicates.ts`): the cards a collect run would have merged had
 * it known. Every merge is the admin's decision, one group at a time: the
 * suggested card to keep is the one on the brand's own store, and any card can
 * be kept instead or left out.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Reason = "gtin" | "mpn" | "name";

interface Store {
  name: string;
  url: string;
  price: number;
  currency: string;
  isOfficial: boolean;
}

interface Card {
  id: string;
  name: string;
  brand: string;
  category: string | null;
  color: string;
  image: string;
  priceMin: number;
  sourceUrl: string | null;
  createdAt: string | null;
  stores: Store[];
}

interface Group {
  keepId: string;
  reasons: Record<string, Reason>;
  products: Card[];
}

interface Report {
  scanned: number;
  dismissalsAvailable: boolean;
  groups: Group[];
}

const REASON_LABEL: Record<Reason, string> = {
  gtin: "Same barcode",
  mpn: "Same maker's code",
  name: "Same model and colours",
};

const GHOST =
  "border border-[var(--border)] rounded-lg px-3 py-2 text-[11px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40";
const PRIMARY =
  "bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40";

function money(amount: number, currency: string): string {
  if (!amount) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function hostOf(url: string | null | undefined): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

function GroupCard({
  group,
  busy,
  onMerge,
  onDismiss,
}: {
  group: Group;
  busy: boolean;
  onMerge: (keepId: string, mergeIds: string[]) => void;
  onDismiss: (ids: string[]) => void;
}) {
  const [keepId, setKeepId] = useState(group.keepId);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const mergeIds = group.products.map((p) => p.id).filter((id) => id !== keepId && !excluded.has(id));
  const first = group.products[0];
  const reasons = [...new Set(Object.values(group.reasons))];

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="rounded-xl border border-[var(--border)]" style={{ background: "var(--background)" }}>
      <header className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm text-[var(--foreground)] truncate">
            {first.brand} · {first.name}
          </h2>
          <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
            {group.products.length} cards · {reasons.map((r) => REASON_LABEL[r]).join(", ")}
          </p>
        </div>
      </header>

      <ul>
        {group.products.map((p) => {
          const keeping = p.id === keepId;
          const included = keeping || !excluded.has(p.id);
          return (
            <li
              key={p.id}
              className={`px-5 py-3 border-b border-[var(--border)] last:border-b-0 flex items-start gap-4 transition-colors ${
                included ? "" : "opacity-45"
              }`}
            >
              <div className="flex flex-col items-center gap-2 pt-1 shrink-0 w-14">
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
                  <input
                    type="radio"
                    name={`keep-${group.keepId}`}
                    checked={keeping}
                    onChange={() => {
                      setKeepId(p.id);
                      setExcluded((prev) => {
                        const next = new Set(prev);
                        next.delete(p.id);
                        return next;
                      });
                    }}
                    className="accent-[var(--foreground)] cursor-pointer"
                    aria-label={`Keep ${p.name}`}
                  />
                  Keep
                </label>
                {!keeping && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggle(p.id)}
                      className="accent-[var(--foreground)] cursor-pointer"
                      aria-label={`Merge ${p.name} into the kept card`}
                    />
                    Merge
                  </label>
                )}
              </div>

              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="w-16 h-16 rounded-lg object-contain bg-white border border-[var(--border)] shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg border border-[var(--border)] shrink-0" style={{ background: "var(--surface)" }} />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/product/${p.id}`}
                    target="_blank"
                    className="text-sm text-[var(--foreground)] hover:underline underline-offset-2 truncate"
                  >
                    {p.name}
                  </Link>
                  {keeping && (
                    <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] tracking-[0.14em] uppercase bg-emerald-400/15 text-emerald-500 border border-emerald-400/30">
                      Kept
                    </span>
                  )}
                  {!keeping && group.reasons[p.id] && (
                    <span className="text-[11px] text-[var(--foreground-muted)]">{REASON_LABEL[group.reasons[p.id]]}</span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                  {[p.color || "no colour", p.category, p.createdAt ? `added ${p.createdAt.slice(0, 10)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {(p.stores.length ? p.stores : [{ name: hostOf(p.sourceUrl), url: p.sourceUrl ?? "", price: p.priceMin, currency: "USD", isOfficial: false }]).map((s) => (
                    <li key={`${s.url}|${s.name}`} className="text-[13px] text-[var(--foreground)]">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline underline-offset-2">
                          {s.name || hostOf(s.url)}
                        </a>
                      ) : (
                        s.name
                      )}
                      <span className="text-[var(--foreground-muted)]"> {money(s.price, s.currency)}</span>
                      {s.isOfficial && <span className="text-[10px] tracking-[0.14em] uppercase text-emerald-500"> official</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed max-w-md">
          Merging moves every store and price onto the kept card, fills its empty fields, moves likes, outfits
          and looks over to it, and deletes the others.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => onDismiss(group.products.map((p) => p.id))} disabled={busy} className={GHOST}>
            Not the same item
          </button>
          <button onClick={() => onMerge(keepId, mergeIds)} disabled={busy || !mergeIds.length} className={PRIMARY}>
            {busy ? "Working…" : `Merge ${mergeIds.length} into kept`}
          </button>
        </div>
      </footer>
    </section>
  );
}

export default function DuplicatesPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/duplicates", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) setError(json?.error || `Failed to load (${res.status})`);
      else setReport(json as Report);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const cards = useMemo(() => report?.groups.reduce((n, g) => n + g.products.length, 0) ?? 0, [report]);

  const post = async (groupKey: string, body: unknown): Promise<Record<string, unknown> | null> => {
    setBusyGroup(groupKey);
    try {
      const res = await fetch("/api/admin/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({ type: "err", msg: json?.error || `Failed (${res.status})` });
        return null;
      }
      return json;
    } catch {
      setToast({ type: "err", msg: "Could not reach the server." });
      return null;
    } finally {
      setBusyGroup(null);
    }
  };

  const removeGroup = (keepId: string) =>
    setReport((r) => (r ? { ...r, groups: r.groups.filter((g) => g.keepId !== keepId) } : r));

  const merge = async (group: Group, keepId: string, mergeIds: string[]) => {
    const keep = group.products.find((p) => p.id === keepId);
    const names = group.products.filter((p) => mergeIds.includes(p.id)).map((p) => `• ${p.name} (${hostOf(p.sourceUrl) || "no store"})`);
    if (!confirm(`Keep "${keep?.name}" and merge into it:\n${names.join("\n")}\n\nThe merged cards are deleted. Their stores, prices, likes and looks move to the kept card.`)) return;
    const json = await post(group.keepId, { action: "merge", keepId, mergeIds });
    if (!json) return;
    const moved = json.moved as { likes: number; outfits: number; looks: number; pendingLooks: number } | undefined;
    const movedText = moved
      ? [moved.likes && `${moved.likes} like(s)`, moved.outfits && `${moved.outfits} outfit(s)`, moved.looks + moved.pendingLooks && `${moved.looks + moved.pendingLooks} look(s)`]
          .filter(Boolean)
          .join(", ")
      : "";
    setToast({ type: "ok", msg: `Merged ${mergeIds.length} card(s)${movedText ? ` — moved ${movedText}` : ""}` });
    removeGroup(group.keepId);
  };

  const dismiss = async (group: Group, ids: string[]) => {
    const json = await post(group.keepId, { action: "dismiss", ids });
    if (!json) return;
    setToast({ type: "ok", msg: "Marked as different items — won't be suggested again" });
    removeGroup(group.keepId);
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Duplicates</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
            {report
              ? `${report.groups.length} item${report.groups.length === 1 ? "" : "s"} held as ${cards} cards, across ${report.scanned} products`
              : "Looking for the same item held twice…"}
          </p>
        </div>
        <button onClick={() => load()} disabled={loading} className={`${GHOST} shrink-0 whitespace-nowrap`}>
          {loading ? "Scanning…" : "Re-scan"}
        </button>
      </div>

      {report && !report.dismissalsAvailable && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-3 mb-6">
          <p className="text-[13px] text-amber-500 leading-relaxed">
            &ldquo;Not the same item&rdquo; cannot be remembered until supabase/migrations/012_label_audit_dismissals.sql is run.
            Merging works without it.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/15 px-4 py-3 text-xs text-red-500">{error}</div>
      )}

      {loading && !report && (
        <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Scanning the catalogue…</div>
      )}

      {report && report.groups.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] px-6 py-16 text-center" style={{ background: "var(--background)" }}>
          <p className="text-sm text-[var(--foreground)]">No duplicates found.</p>
          <p className="text-xs text-[var(--foreground-muted)] mt-2">
            No two cards share a barcode, or the same model in the same colours from different stores.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {report?.groups.map((group) => (
          <GroupCard
            key={group.keepId}
            group={group}
            busy={busyGroup === group.keepId}
            onMerge={(keepId, mergeIds) => merge(group, keepId, mergeIds)}
            onDismiss={(ids) => dismiss(group, ids)}
          />
        ))}
      </div>

      {report && report.groups.length > 0 && (
        <p className="text-[11px] text-[var(--foreground-muted)] mt-6 leading-relaxed max-w-2xl">
          Two cards are proposed when they share a barcode or maker&apos;s code, or when they are the same model of one
          brand in the same colours, sold by different stores at comparable prices — the test a collect run uses before
          it adds a second store to a card. A model made in two similar colourways at one store is left out: it cannot
          be told which one the other store sells.
        </p>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 text-xs tracking-wide rounded-xl border ${
            toast.type === "ok"
              ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
              : "bg-[var(--background)] text-red-500 border-red-400/30"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
