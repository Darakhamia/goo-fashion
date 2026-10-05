"use client";

/**
 * Duplicates — the same item held as more than one card, and one click to make
 * it one card with every place to buy it. Beside it, two colour-group repairs:
 * one model's colours sitting as separate cards (group them), and a colour
 * group holding several models (split it).
 *
 * The finder applies the importer's own same-item test to the whole catalogue
 * (`lib/server/duplicates.ts`): the cards a collect run would have merged had
 * it known. Every merge is the admin's decision, one group at a time: the
 * suggested card to keep is the one on the brand's own store, and any card can
 * be kept instead or left out.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bareHost } from "@/lib/url";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { useToast } from "@/components/admin/Toast";
import { btn } from "@/app/goo-studio/_ui/recipes";

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
  /** Cards in its colour group, itself included; 0 when it is in none. */
  groupSize?: number;
  stores: Store[];
}

interface Group {
  keepId: string;
  reasons: Record<string, Reason>;
  products: Card[];
}

interface MixedGroup {
  groupId: string;
  /** One list per model; the suggested one to keep first. */
  families: Card[][];
}

/** One model's colours held as separate cards (or separate colour groups). */
interface Colourway {
  /** Leads the group when none of the groups it joins has a lead. */
  leadId: string;
  products: Card[];
}

interface Report {
  scanned: number;
  dismissalsAvailable: boolean;
  groups: Group[];
  mixedGroups?: MixedGroup[];
  colourways?: Colourway[];
}

/** Proposals sent per "Group all" request — the route's own limit. */
const GROUP_BATCH = 50;

const REASON_LABEL: Record<Reason, string> = {
  gtin: "Same barcode",
  mpn: "Same maker's code",
  name: "Same model and colours",
};

function money(amount: number, currency: string): string {
  if (!amount) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
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
  /** `against` empty: every card in `ids` is a different item. Otherwise each of `ids` differs from each of `against`. */
  onDismiss: (ids: string[], against: string[]) => void;
}) {
  const [keepId, setKeepId] = useState(group.keepId);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const mergeIds = group.products.map((p) => p.id).filter((id) => id !== keepId && !excluded.has(id));
  // With some cards unticked, "not the same" means those cards, against the
  // ones kept together — not the whole group.
  const unticked = group.products.map((p) => p.id).filter((id) => id !== keepId && excluded.has(id));
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
    <section className="rounded-xl border border-[var(--border)]" style={{ background: "var(--surface)" }}>
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
              className={`px-5 py-3 border-b border-[var(--border)] last:border-b-0 flex items-start gap-3 md:gap-4 transition-colors ${
                included ? "" : "opacity-45"
              }`}
            >
              <div className="flex flex-col items-center gap-2 pt-1 shrink-0 w-14">
                <label className="flex items-center gap-1.5 min-h-10 md:min-h-0 cursor-pointer text-[12px] text-[var(--foreground-muted)]">
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
                  <label className="flex items-center gap-1.5 min-h-10 md:min-h-0 cursor-pointer text-[12px] text-[var(--foreground-muted)]">
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
                <img src={p.image} alt="" className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-contain bg-white border border-[var(--border)] shrink-0" />
              ) : (
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg border border-[var(--border)] shrink-0" style={{ background: "var(--background)" }} />
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
                    <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok-line)]">
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
                  {(p.stores.length ? p.stores : [{ name: bareHost(p.sourceUrl), url: p.sourceUrl ?? "", price: p.priceMin, currency: "USD", isOfficial: false }]).map((s) => (
                    <li key={`${s.url}|${s.name}`} className="text-[13px] text-[var(--foreground)]">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline underline-offset-2">
                          {s.name || bareHost(s.url)}
                        </a>
                      ) : (
                        s.name
                      )}
                      <span className="text-[var(--foreground-muted)]"> {money(s.price, s.currency)}</span>
                      {s.isOfficial && <span className="text-[11px] font-medium text-[var(--ok)]"> official</span>}
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              unticked.length
                ? onDismiss(unticked, [keepId, ...mergeIds])
                : onDismiss(group.products.map((p) => p.id), [])
            }
            disabled={busy}
            title={
              unticked.length
                ? "Remember the unticked cards as different from the ones kept together"
                : "Remember every card in this group as a different item"
            }
            className={btn("ghost")}
          >
            {unticked.length ? `Unticked aren't the same (${unticked.length})` : "Not the same item"}
          </button>
          <button onClick={() => onMerge(keepId, mergeIds)} disabled={busy || !mergeIds.length} className={btn("primary")}>
            {busy ? "Working…" : `Merge ${mergeIds.length} into kept`}
          </button>
        </div>
      </footer>
    </section>
  );
}

/** One model's colours shown as separate cards, and the grouping that makes them one product. */
function ColourwayCard({
  proposal,
  busy,
  onGroup,
  onDismiss,
}: {
  proposal: Colourway;
  busy: boolean;
  onGroup: () => void;
  onDismiss: () => void;
}) {
  const first = proposal.products[0];
  const colours = [...new Set(proposal.products.map((p) => p.color || "no colour"))];
  return (
    <section className="rounded-xl border border-[var(--border)]" style={{ background: "var(--surface)" }}>
      <header className="px-5 py-3.5 border-b border-[var(--border)]">
        <h2 className="text-sm text-[var(--foreground)] truncate">
          {first.brand} · {first.name}
        </h2>
        <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
          {proposal.products.length} cards · {colours.join(", ")}
        </p>
      </header>
      <ul>
        {proposal.products.map((p) => {
          const store = p.stores[0] ?? { name: bareHost(p.sourceUrl), url: p.sourceUrl ?? "", price: p.priceMin, currency: "USD", isOfficial: false };
          return (
            <li key={p.id} className="px-5 py-3 border-b border-[var(--border)] last:border-b-0 flex items-center gap-3 md:gap-4 min-w-0">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-contain bg-white border border-[var(--border)] shrink-0" />
              ) : (
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg border border-[var(--border)] shrink-0" style={{ background: "var(--background)" }} />
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
                  {p.id === proposal.leadId && (
                    <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--background)] text-[var(--foreground-muted)] border border-[var(--border)]">
                      Shown first
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5 truncate">
                  {[
                    p.color || "no colour",
                    store.name || bareHost(store.url),
                    money(store.price, store.currency),
                    p.groupSize && p.groupSize > 1 ? `already grouped with ${p.groupSize - 1}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <footer className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed max-w-md">
          Grouping shows these as one product with a swatch per colour, each colour keeping its own price and
          stores. A card already in a colour group brings the rest of its group. Nothing is deleted.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onDismiss} disabled={busy} title="Remember these cards as different models" className={btn("ghost")}>
            Not one model
          </button>
          <button onClick={onGroup} disabled={busy} className={btn("secondary")}>
            {busy ? "Working…" : "Group as colours"}
          </button>
        </div>
      </footer>
    </section>
  );
}

/** A colour group whose members are different models, and the split that fixes it. */
function MixedGroupCard({
  group,
  busy,
  onSplit,
}: {
  group: MixedGroup;
  busy: boolean;
  onSplit: (keepIds: string[]) => void;
}) {
  const [keep, setKeep] = useState(0);
  const count = group.families.reduce((n, f) => n + f.length, 0);
  return (
    <section className="rounded-xl border border-[var(--border)]" style={{ background: "var(--surface)" }}>
      <header className="px-5 py-3.5 border-b border-[var(--border)]">
        <h2 className="text-sm text-[var(--foreground)] truncate">
          {group.families[0][0]?.brand} · one colour group, {group.families.length} different models
        </h2>
        <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">{count} cards shown as colours of one product</p>
      </header>
      <ul>
        {group.families.map((family, i) => (
          <li key={family[0].id} className="px-5 py-3 border-b border-[var(--border)] last:border-b-0 flex items-start gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer pt-1 shrink-0 w-14 text-[12px] text-[var(--foreground-muted)]">
              <input
                type="radio"
                name={`family-${group.groupId}`}
                checked={keep === i}
                onChange={() => setKeep(i)}
                className="accent-[var(--foreground)] cursor-pointer"
                aria-label={`Keep ${family[0].name} in this group`}
              />
              Keep
            </label>
            <ul className="min-w-0 flex-1 flex flex-col gap-2">
              {family.map((p) => (
                <li key={p.id} className="flex items-center gap-3 min-w-0">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-contain bg-white border border-[var(--border)] shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg border border-[var(--border)] shrink-0" style={{ background: "var(--background)" }} />
                  )}
                  <div className="min-w-0">
                    <Link href={`/product/${p.id}`} target="_blank" className="block text-[13px] text-[var(--foreground)] hover:underline underline-offset-2 truncate">
                      {p.name}
                    </Link>
                    <p className="text-[11px] text-[var(--foreground-muted)] truncate">
                      {[p.color || "no colour", bareHost(p.sourceUrl)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <footer className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed max-w-md">
          The kept model stays in the group. Each other model gets a group of its own, and a lone card
          leaves grouping. Nothing is deleted.
        </p>
        <button onClick={() => onSplit(group.families[keep].map((p) => p.id))} disabled={busy} className={btn("secondary")}>
          {busy ? "Working…" : "Split"}
        </button>
      </footer>
    </section>
  );
}

export default function DuplicatesPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  /** "Group all" under way: how many proposals are done out of how many. */
  const [groupingAll, setGroupingAll] = useState<{ done: number; total: number } | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const help = useHelp("duplicates");
  const mixedHelp = useHelp("duplicates-mixed");
  const colourwaysHelp = useHelp("duplicates-colourways");

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
        toast.err(json?.error || `Failed (${res.status})`);
        return null;
      }
      return json;
    } catch {
      toast.err("Could not reach the server.");
      return null;
    } finally {
      setBusyGroup(null);
    }
  };

  const removeGroup = (keepId: string) =>
    setReport((r) => (r ? { ...r, groups: r.groups.filter((g) => g.keepId !== keepId) } : r));

  const merge = async (group: Group, keepId: string, mergeIds: string[]) => {
    const keep = group.products.find((p) => p.id === keepId);
    const merging = group.products.filter((p) => mergeIds.includes(p.id));
    const cardsText = `${mergeIds.length} card${mergeIds.length === 1 ? "" : "s"}`;
    if (
      !(await confirm({
        title: `Merge ${cardsText} into "${keep?.name}"?`,
        body: (
          <>
            <ul>
              {merging.map((p) => (
                <li key={p.id}>{`• ${p.name} (${bareHost(p.sourceUrl) || "no store"})`}</li>
              ))}
            </ul>
            <p className="mt-2">The merged cards are deleted. Their stores, prices, likes and looks move to the kept card.</p>
          </>
        ),
        confirmLabel: `Merge ${cardsText}`,
        tone: "danger",
      }))
    )
      return;
    const json = await post(group.keepId, { action: "merge", keepId, mergeIds });
    if (!json) return;
    const moved = json.moved as { likes: number; outfits: number; looks: number; pendingLooks: number } | undefined;
    const movedText = moved
      ? [moved.likes && `${moved.likes} like(s)`, moved.outfits && `${moved.outfits} outfit(s)`, moved.looks + moved.pendingLooks && `${moved.looks + moved.pendingLooks} look(s)`]
          .filter(Boolean)
          .join(", ")
      : "";
    toast.ok(`Merged ${mergeIds.length} card(s)${movedText ? ` — moved ${movedText}` : ""}`);
    removeGroup(group.keepId);
  };

  const split = async (group: MixedGroup, keepIds: string[]) => {
    const kept = group.families.find((f) => f[0] && keepIds.includes(f[0].id));
    const others = group.families.length - 1;
    if (
      !(await confirm({
        title: `Take the other ${others} model${others === 1 ? "" : "s"} out of this colour group?`,
        body: `"${kept?.[0]?.name}" stays in this colour group.`,
        confirmLabel: `Split out ${others} model${others === 1 ? "" : "s"}`,
      }))
    )
      return;
    const json = await post(group.groupId, { action: "split", groupId: group.groupId, keepIds });
    if (!json) return;
    toast.ok(`Split — ${json.movedOut} card(s) moved out of the group`);
    setReport((r) => (r ? { ...r, mixedGroups: (r.mixedGroups ?? []).filter((g) => g.groupId !== group.groupId) } : r));
  };

  const removeColourways = (leadIds: Set<string>) =>
    setReport((r) => (r ? { ...r, colourways: (r.colourways ?? []).filter((c) => !leadIds.has(c.leadId)) } : r));

  const groupColours = async (proposal: Colourway) => {
    const json = await post(proposal.leadId, {
      action: "group",
      groups: [{ ids: proposal.products.map((p) => p.id), leadId: proposal.leadId }],
    });
    if (!json) return;
    toast.ok(`Grouped ${proposal.products.length} cards as colours of one product`);
    removeColourways(new Set([proposal.leadId]));
  };

  const groupAllColours = async () => {
    const all = report?.colourways ?? [];
    if (!all.length) return;
    if (
      !(await confirm({
        title: `Group all ${all.length} as colours of one product each?`,
        body: "Each becomes one card with a swatch per colour. Nothing is deleted, and any group can be split again later.",
        confirmLabel: `Group all ${all.length}`,
      }))
    )
      return;
    setGroupingAll({ done: 0, total: all.length });
    const grouped = new Set<string>();
    let failed = 0;
    for (let i = 0; i < all.length; i += GROUP_BATCH) {
      const batch = all.slice(i, i + GROUP_BATCH);
      const json = await post("__all__", {
        action: "group",
        groups: batch.map((c) => ({ ids: c.products.map((p) => p.id), leadId: c.leadId })),
      });
      if (!json) {
        failed += batch.length;
      } else {
        for (const g of (json.grouped as { leadId: string }[] | undefined) ?? []) grouped.add(g.leadId);
        failed += ((json.failed as unknown[] | undefined) ?? []).length;
      }
      setGroupingAll({ done: Math.min(i + GROUP_BATCH, all.length), total: all.length });
    }
    setGroupingAll(null);
    removeColourways(grouped);
    if (failed) toast.err(`Grouped ${grouped.size}, ${failed} could not be grouped — re-scan and try again`);
    else toast.ok(`Grouped ${grouped.size} product${grouped.size === 1 ? "" : "s"}' colours`);
  };

  const dismissColours = async (proposal: Colourway) => {
    const ids = proposal.products.map((p) => p.id);
    if (
      !(await confirm({
        title: `Remember these ${ids.length} cards as different models?`,
        body: "They won't be proposed as colours of one product again.",
        confirmLabel: `Mark ${ids.length} cards as different models`,
        tone: "danger",
      }))
    )
      return;
    const json = await post(proposal.leadId, { action: "dismiss", kind: "colourway", ids });
    if (!json) return;
    toast.ok("Marked as different models — won't be suggested again");
    removeColourways(new Set([proposal.leadId]));
  };

  const dismiss = async (group: Group, ids: string[], against: string[]) => {
    const line = (id: string) => {
      const p = group.products.find((x) => x.id === id);
      return p ? `• ${p.name} (${bareHost(p.sourceUrl) || "no store"})` : `• ${id}`;
    };
    const cardsText = `${ids.length} card${ids.length === 1 ? "" : "s"}`;
    const list = (
      <ul>
        {ids.map((id) => (
          <li key={id}>{line(id)}</li>
        ))}
      </ul>
    );
    const question = against.length
      ? {
          title: `Remember these ${cardsText} as different items from the cards kept together?`,
          body: (
            <>
              {list}
              <p className="mt-2">They won&apos;t be proposed with those cards again. The rest of the group stays.</p>
            </>
          ),
          confirmLabel: `Mark ${cardsText} as different`,
        }
      : {
          title: "Remember every card here as a different item?",
          body: (
            <>
              {list}
              <p className="mt-2">They won&apos;t be proposed together again, and this can&apos;t be undone from here.</p>
            </>
          ),
          confirmLabel: `Mark ${cardsText} as different`,
        };
    if (!(await confirm({ ...question, tone: "danger" }))) return;
    const json = await post(group.keepId, { action: "dismiss", ids, ...(against.length ? { against } : {}) });
    if (!json) return;
    if (!against.length) {
      toast.ok("Marked as different items — won't be suggested again");
      removeGroup(group.keepId);
      return;
    }
    // Only the unticked cards leave; what remains is still a proposal, unless
    // a single card is left.
    const gone = new Set(ids);
    setReport((r) =>
      r
        ? {
            ...r,
            groups: r.groups.flatMap((g) => {
              if (g.keepId !== group.keepId) return [g];
              const products = g.products.filter((p) => !gone.has(p.id));
              return products.length > 1 ? [{ ...g, products }] : [];
            }),
          }
        : r,
    );
    toast.ok(`Marked ${ids.length} card(s) as different — won't be suggested with the rest again`);
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Duplicates</h1>
            <HelpButton help={help} label="How duplicates are found" />
          </div>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
            {report
              ? `${report.groups.length} item${report.groups.length === 1 ? "" : "s"} held as ${cards} cards, across ${report.scanned} products`
              : "Looking for the same item held twice…"}
          </p>
          {help.open && (
            <div className="mt-3">
              <HelpPanel help={help}>
                <p>
                  Two cards are proposed when they share a barcode or maker&apos;s code, or when they are the same model of one
                  brand in the same colours, sold by different stores at any price — the test a collect run uses before it adds
                  a second store to a card. A model made in two similar colourways at one store is left out: it cannot
                  be told which one the other store sells.
                </p>
              </HelpPanel>
            </div>
          )}
        </div>
        <button onClick={() => load()} disabled={loading} className={`${btn("secondary")} shrink-0`}>
          {loading ? "Scanning…" : "Re-scan"}
        </button>
      </div>

      {report && !report.dismissalsAvailable && (
        <div className="rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3 mb-6">
          <p className="text-[13px] text-[var(--warn)] leading-relaxed">
            &ldquo;Not the same item&rdquo; cannot be remembered until supabase/migrations/012_label_audit_dismissals.sql is run.
            Merging works without it.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-3 text-xs text-[var(--err)]">{error}</div>
      )}

      {loading && !report && (
        <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Scanning the catalogue…</div>
      )}

      {report && (report.mixedGroups?.length ?? 0) > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-1 mb-3">
            <h2 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">
              Colour groups mixing different models ({report.mixedGroups!.length})
            </h2>
            <HelpButton help={mixedHelp} label="About colour groups mixing different models" />
          </div>
          {mixedHelp.open && (
            <div className="mb-3">
              <HelpPanel help={mixedHelp}>
                <p>
                  Cards shown as colours of one product that are not one model — usually a store&apos;s &ldquo;you may also
                  like&rdquo; rail read as its colour row. Choose the model that belongs, then split the rest out.
                </p>
              </HelpPanel>
            </div>
          )}
          <div className="flex flex-col gap-5">
            {report.mixedGroups!.map((group) => (
              <MixedGroupCard
                key={group.groupId}
                group={group}
                busy={busyGroup === group.groupId || !!groupingAll}
                onSplit={(keepIds) => split(group, keepIds)}
              />
            ))}
          </div>
        </div>
      )}

      {report && (report.colourways?.length ?? 0) > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div className="min-w-0 max-w-2xl flex items-center gap-1">
              <h2 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">
                One model&apos;s colours shown as separate cards ({report.colourways!.length})
              </h2>
              <HelpButton help={colourwaysHelp} label="About one model's colours shown as separate cards" />
            </div>
            <button
              onClick={() => groupAllColours()}
              disabled={!!groupingAll || !!busyGroup}
              className={`${btn("primary")} shrink-0`}
            >
              {groupingAll ? `Grouping ${groupingAll.done}/${groupingAll.total}…` : `Group all (${report.colourways!.length})`}
            </button>
          </div>
          {colourwaysHelp.open && (
            <div className="mb-3">
              <HelpPanel help={colourwaysHelp}>
                <p>
                  The same piece of one brand in different colours, held as separate cards or separate colour groups —
                  usually collected from different stores, under another spelling of the brand or at another price.
                  Grouping makes each one product with a swatch per colour.
                </p>
              </HelpPanel>
            </div>
          )}
          <div className="flex flex-col gap-5">
            {report.colourways!.map((proposal) => (
              <ColourwayCard
                key={proposal.leadId}
                proposal={proposal}
                busy={busyGroup === proposal.leadId || !!groupingAll}
                onGroup={() => groupColours(proposal)}
                onDismiss={() => dismissColours(proposal)}
              />
            ))}
          </div>
        </div>
      )}

      {report && ((report.mixedGroups?.length ?? 0) > 0 || (report.colourways?.length ?? 0) > 0) && (
        <h2 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-4">
          The same item held twice
        </h2>
      )}

      {report && report.groups.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] px-6 py-16 text-center" style={{ background: "var(--surface)" }}>
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
            busy={busyGroup === group.keepId || !!groupingAll}
            onMerge={(keepId, mergeIds) => merge(group, keepId, mergeIds)}
            onDismiss={(ids, against) => dismiss(group, ids, against)}
          />
        ))}
      </div>

    </div>
  );
}
