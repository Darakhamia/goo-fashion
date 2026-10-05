"use client";

/**
 * Duplicates — the same item held as more than one card, and one click to make
 * it one card with every place to buy it. Beside it, two color-group repairs:
 * one model's colors sitting as separate cards (group them), and a color
 * group holding several models (split it).
 *
 * The finder applies the importer's own same-item test to the whole catalog
 * (`lib/server/duplicates.ts`): the cards a collect run would have merged had
 * it known. Every merge is the admin's decision, one group at a time: the
 * suggested card to keep is the one on the brand's own store, and any card can
 * be kept instead or left out.
 *
 * Laid out per docs/ADMIN_DESIGN.md §6 "Duplicates" and its mockup (GS4-12):
 * two tabs, duplicates first and the color groups second; the explanations
 * once, under the header's "?", not in every card; Split and Merge outlined.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bareHost } from "@/lib/url";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { useToast } from "@/components/admin/Toast";
import { PageHeader } from "@/components/admin/PageHeader";
import { AttentionList, type AttentionRow } from "@/components/admin/AttentionList";
import { Badge } from "@/components/admin/Badge";
import { Tabs, tabPanel } from "@/components/admin/Tabs";
import { EmptyState, Thumb } from "@/components/admin/DataTable";
import { btn } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT, type Key, type T, type Vars } from "@/app/goo-studio/_i18n";

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
  /** Cards in its color group, itself included; 0 when it is in none. */
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

/** One model's colors held as separate cards (or separate color groups). */
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

type View = "duplicates" | "colors";

/** A load failure: the server's own words, or a dictionary key. */
type Failure = string | { key: Key; vars?: Vars };

function sayFailure(f: Failure, t: T): string {
  return typeof f === "string" ? f : t(f.key, f.vars);
}

/** Proposals sent per "Group all" request — the route's own limit. */
const GROUP_BATCH = 50;

const REASON_KEY: Record<Reason, Key> = {
  gtin: "dupes.reason.gtin",
  mpn: "dupes.reason.mpn",
  name: "dupes.reason.name",
};

const PANEL = "rounded-xl border border-[var(--border)] bg-[var(--surface)]";
const H2 = "text-[15px] leading-[22px] font-medium text-[var(--foreground)]";
const MUTED = "text-[12px] leading-[18px] text-[var(--foreground-muted)]";
const FOOTER = "flex flex-wrap items-center justify-end gap-2 px-4 md:px-5 py-3 border-t border-[var(--border)]";
const PRODUCT_LINK = "text-[13px] leading-5 font-medium text-[var(--foreground)] hover:underline underline-offset-2 break-words";

const CHECK = (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A store's price in its own currency, through the admin's one format (GS4-6); "—" for none. */
function useMoney() {
  const f = useFormat();
  return (amount: number, currency: string) => (amount ? f.money(amount, currency || "USD") : "—");
}

/** A card's stores; one built from its source link when it has none listed. */
function storesOf(p: Card): Store[] {
  return p.stores.length ? p.stores : [{ name: bareHost(p.sourceUrl), url: p.sourceUrl ?? "", price: p.priceMin, currency: "USD", isOfficial: false }];
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
  const t = useT();
  const f = useFormat();
  const money = useMoney();
  const [keepId, setKeepId] = useState(group.keepId);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const mergeIds = group.products.map((p) => p.id).filter((id) => id !== keepId && !excluded.has(id));
  // With some cards unticked, "not the same" means those cards, against the
  // ones kept together — not the whole group.
  const unticked = group.products.map((p) => p.id).filter((id) => id !== keepId && excluded.has(id));
  const first = group.products[0];
  const reasons = [...new Set(Object.values(group.reasons))];
  const titleId = `dupes-group-${group.keepId}`;

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section aria-labelledby={titleId} className={`${PANEL} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-5 py-3.5 border-b border-[var(--border)]">
        <div className="flex-[1_1_320px] min-w-0">
          <h2 id={titleId} className={`${H2} truncate`}>
            {first.name}
          </h2>
          <p className={MUTED}>
            {[first.brand, first.category, t("dupes.group.cards", { count: group.products.length })].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <Badge key={r} tone="ok">
              {CHECK}
              {t(REASON_KEY[r])}
            </Badge>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-5 pt-4 pb-5">
        <fieldset className="min-w-0">
          <legend className="mb-2.5 text-[12px] font-medium text-[var(--foreground-muted)]">{t("dupes.group.whichStays")}</legend>
          <div className="flex flex-wrap gap-3">
            {group.products.map((p) => {
              const keeping = p.id === keepId;
              const included = keeping || !excluded.has(p.id);
              const stores = storesOf(p);
              const store = stores[0]?.name || bareHost(stores[0]?.url ?? null) || t("dupes.noStore");
              return (
                <div
                  key={p.id}
                  className={`flex-[1_1_320px] min-w-0 flex items-start gap-3.5 p-3.5 rounded-lg border transition-[opacity,border-color] ${
                    keeping ? "border-[var(--foreground)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--background)]"
                  } ${included ? "" : "opacity-45"}`}
                >
                  <Thumb src={p.image} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/product/${p.id}`} target="_blank" className={PRODUCT_LINK}>
                        {p.name}
                      </Link>
                      {keeping && <Badge tone="inverse">{t("dupes.kept")}</Badge>}
                      {!keeping && group.reasons[p.id] && <span className={MUTED}>{t(REASON_KEY[group.reasons[p.id]])}</span>}
                    </div>
                    <p className={MUTED}>
                      {[p.color || t("dupes.noColor"), p.category, p.createdAt ? t("dupes.added", { date: f.date(p.createdAt) }) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {stores.map((s) => (
                        <li key={`${s.url}|${s.name}`} className="flex flex-wrap items-center gap-x-2 text-[13px] leading-5 text-[var(--foreground)]">
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noreferrer" className="font-medium hover:underline underline-offset-2">
                              {s.name || bareHost(s.url)}
                            </a>
                          ) : (
                            <span className="font-medium">{s.name}</span>
                          )}
                          <span className="tabular-nums">{money(s.price, s.currency)}</span>
                          {s.isOfficial && <Badge tone="ok">{t("dupes.official")}</Badge>}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4">
                      <label className="inline-flex items-center gap-2 min-h-10 md:min-h-7 cursor-pointer text-[13px] font-medium text-[var(--foreground)]">
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
                          className="w-4 h-4 accent-[var(--foreground)] cursor-pointer"
                          aria-label={t("dupes.keepAria", { name: p.name, store })}
                        />
                        {t("dupes.keepThis")}
                      </label>
                      {!keeping && (
                        <label className="inline-flex items-center gap-2 min-h-10 md:min-h-7 cursor-pointer text-[13px] text-[var(--foreground-muted)]">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => toggle(p.id)}
                            className="w-4 h-4 accent-[var(--foreground)] cursor-pointer"
                            aria-label={t("dupes.mergeAria", { name: p.name, store })}
                          />
                          {t("dupes.mergeThis")}
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className={FOOTER}>
        <button
          onClick={() =>
            unticked.length
              ? onDismiss(unticked, [keepId, ...mergeIds])
              : onDismiss(group.products.map((p) => p.id), [])
          }
          disabled={busy}
          title={unticked.length ? t("dupes.notSameSomeHint") : t("dupes.notSameHint")}
          className={btn("ghost")}
        >
          {unticked.length ? t("dupes.notSameSome", { count: unticked.length }) : t("dupes.notSame")}
        </button>
        <button onClick={() => onMerge(keepId, mergeIds)} disabled={busy || !mergeIds.length} className={btn("secondary")}>
          {busy ? t("dupes.working") : t("dupes.merge", { count: mergeIds.length })}
        </button>
      </div>
    </section>
  );
}

/** One model's colors shown as separate cards, and the grouping that makes them one product. */
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
  const t = useT();
  const money = useMoney();
  const first = proposal.products[0];
  const colors = [...new Set(proposal.products.map((p) => p.color || t("dupes.noColor")))];
  const titleId = `dupes-cw-${proposal.leadId}`;
  return (
    <section aria-labelledby={titleId} className={`${PANEL} overflow-hidden`}>
      <div className="px-4 md:px-5 py-3.5 border-b border-[var(--border)]">
        <h3 id={titleId} className={`${H2} truncate`}>
          {first.name}
        </h3>
        <p className={MUTED}>{[first.brand, t("dupes.cw.cards", { count: proposal.products.length }), colors.join(", ")].join(" · ")}</p>
      </div>
      <ul>
        {proposal.products.map((p, i) => {
          const store = p.stores[0] ?? { name: bareHost(p.sourceUrl), url: p.sourceUrl ?? "", price: p.priceMin, currency: "USD", isOfficial: false };
          return (
            <li key={p.id} className={`flex items-center gap-3 md:gap-4 min-w-0 px-4 md:px-5 py-3 ${i ? "border-t border-[var(--border)]" : ""}`}>
              <Thumb src={p.image} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`/product/${p.id}`} target="_blank" className={PRODUCT_LINK}>
                    {p.name}
                  </Link>
                  {p.id === proposal.leadId && <Badge>{t("dupes.cw.shownFirst")}</Badge>}
                </div>
                <p className={`${MUTED} truncate`}>
                  {[
                    p.color || t("dupes.noColor"),
                    store.name || bareHost(store.url),
                    money(store.price, store.currency),
                    p.groupSize && p.groupSize > 1 ? t("dupes.cw.alreadyGrouped", { count: p.groupSize - 1 }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className={FOOTER}>
        <button onClick={onDismiss} disabled={busy} title={t("dupes.cw.notOneHint")} className={btn("ghost")}>
          {t("dupes.cw.notOne")}
        </button>
        <button onClick={onGroup} disabled={busy} className={btn("secondary")}>
          {busy ? t("dupes.working") : t("dupes.cw.group")}
        </button>
      </div>
    </section>
  );
}

/** A color group whose members are different models, and the split that fixes it. */
function MixedGroupCard({
  group,
  busy,
  onSplit,
}: {
  group: MixedGroup;
  busy: boolean;
  onSplit: (keepIds: string[]) => void;
}) {
  const t = useT();
  const [keep, setKeep] = useState(0);
  const count = group.families.reduce((n, f) => n + f.length, 0);
  const titleId = `dupes-mixed-${group.groupId}`;
  return (
    <section aria-labelledby={titleId} className={`${PANEL} overflow-hidden`}>
      <div className="px-4 md:px-5 py-3.5 border-b border-[var(--border)]">
        <h3 id={titleId} className={`${H2} truncate`}>
          {t("dupes.mixed.cardTitle", { brand: group.families[0][0]?.brand ?? "", count: group.families.length })}
        </h3>
        <p className={MUTED}>{t("dupes.mixed.cards", { count })}</p>
      </div>
      <ul>
        {group.families.map((family, i) => (
          <li key={family[0].id} className={`flex items-start gap-4 px-4 md:px-5 py-3 ${i ? "border-t border-[var(--border)]" : ""}`}>
            <label className="flex flex-shrink-0 items-center gap-2 w-20 min-h-10 cursor-pointer text-[13px] font-medium text-[var(--foreground)]">
              <input
                type="radio"
                name={`family-${group.groupId}`}
                checked={keep === i}
                onChange={() => setKeep(i)}
                className="w-4 h-4 accent-[var(--foreground)] cursor-pointer"
                aria-label={t("dupes.mixed.keepAria", { name: family[0].name })}
              />
              {t("dupes.keep")}
            </label>
            <ul className="min-w-0 flex-1 flex flex-col gap-2">
              {family.map((p) => (
                <li key={p.id} className="flex items-center gap-3 min-w-0">
                  <Thumb src={p.image} />
                  <div className="min-w-0">
                    <Link href={`/product/${p.id}`} target="_blank" className={`block truncate ${PRODUCT_LINK}`}>
                      {p.name}
                    </Link>
                    <p className={`${MUTED} truncate`}>{[p.color || t("dupes.noColor"), bareHost(p.sourceUrl)].filter(Boolean).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className={FOOTER}>
        <button onClick={() => onSplit(group.families[keep].map((p) => p.id))} disabled={busy} className={btn("secondary")}>
          {busy ? t("dupes.working") : t("dupes.split")}
        </button>
      </div>
    </section>
  );
}

export default function DuplicatesPage() {
  const t = useT();
  const f = useFormat();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Failure | null>(null);
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  /** "Group all" under way: how many proposals are done out of how many. */
  const [groupingAll, setGroupingAll] = useState<{ done: number; total: number } | null>(null);
  const [view, setView] = useState<View>("duplicates");
  const confirm = useConfirm();
  const toast = useToast();
  const help = useHelp("duplicates");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/duplicates", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) setError(json?.error || { key: "dupes.loadFailed", vars: { status: res.status } });
      else setReport(json as Report);
    } catch {
      setError({ key: "dupes.unreachable" });
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
        toast.err(json?.error || t("dupes.failed", { status: res.status }));
        return null;
      }
      return json;
    } catch {
      toast.err(t("dupes.unreachable"));
      return null;
    } finally {
      setBusyGroup(null);
    }
  };

  const removeGroup = (keepId: string) =>
    setReport((r) => (r ? { ...r, groups: r.groups.filter((g) => g.keepId !== keepId) } : r));

  /** "• Name (store)" for the lists in the confirmations. */
  const cardLine = (p: Card) => `• ${p.name} (${bareHost(p.sourceUrl) || t("dupes.noStore")})`;

  const merge = async (group: Group, keepId: string, mergeIds: string[]) => {
    const keep = group.products.find((p) => p.id === keepId);
    const merging = group.products.filter((p) => mergeIds.includes(p.id));
    if (
      !(await confirm({
        title: t("dupes.confirm.merge", { count: mergeIds.length, name: keep?.name ?? "" }),
        body: (
          <>
            <ul>
              {merging.map((p) => (
                <li key={p.id}>{cardLine(p)}</li>
              ))}
            </ul>
            <p className="mt-2">{t("dupes.confirm.mergeBody")}</p>
          </>
        ),
        confirmLabel: t("dupes.confirm.mergeAction", { count: mergeIds.length }),
        tone: "danger",
      }))
    )
      return;
    const json = await post(group.keepId, { action: "merge", keepId, mergeIds });
    if (!json) return;
    const moved = json.moved as { likes: number; outfits: number; looks: number; pendingLooks: number } | undefined;
    const movedText = moved
      ? [
          moved.likes && t("dupes.moved.likes", { count: moved.likes }),
          moved.outfits && t("dupes.moved.outfits", { count: moved.outfits }),
          moved.looks + moved.pendingLooks && t("dupes.moved.looks", { count: moved.looks + moved.pendingLooks }),
        ]
          .filter(Boolean)
          .join(", ")
      : "";
    toast.ok(
      movedText
        ? t("dupes.mergedMoved", { count: mergeIds.length, moved: movedText })
        : t("dupes.merged", { count: mergeIds.length }),
    );
    removeGroup(group.keepId);
  };

  const split = async (group: MixedGroup, keepIds: string[]) => {
    const kept = group.families.find((f) => f[0] && keepIds.includes(f[0].id));
    const others = group.families.length - 1;
    if (
      !(await confirm({
        title: t("dupes.confirm.split", { count: others }),
        body: t("dupes.confirm.splitBody", { name: kept?.[0]?.name ?? "" }),
        confirmLabel: t("dupes.confirm.splitAction", { count: others }),
      }))
    )
      return;
    const json = await post(group.groupId, { action: "split", groupId: group.groupId, keepIds });
    if (!json) return;
    toast.ok(t("dupes.splitDone", { count: Number(json.movedOut ?? 0) }));
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
    toast.ok(t("dupes.cw.grouped", { count: proposal.products.length }));
    removeColourways(new Set([proposal.leadId]));
  };

  const groupAllColours = async () => {
    const all = report?.colourways ?? [];
    if (!all.length) return;
    if (
      !(await confirm({
        title: t("dupes.confirm.groupAll", { count: all.length }),
        body: t("dupes.confirm.groupAllBody"),
        confirmLabel: t("dupes.confirm.groupAllAction", { count: all.length }),
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
    if (failed) toast.err(t("dupes.cw.groupAllPartial", { grouped: grouped.size, count: failed }));
    else toast.ok(t("dupes.cw.groupAllDone", { count: grouped.size }));
  };

  const dismissColours = async (proposal: Colourway) => {
    const ids = proposal.products.map((p) => p.id);
    if (
      !(await confirm({
        title: t("dupes.confirm.cwDismiss", { count: ids.length }),
        body: t("dupes.confirm.cwDismissBody"),
        confirmLabel: t("dupes.confirm.cwDismissAction", { count: ids.length }),
        tone: "danger",
      }))
    )
      return;
    const json = await post(proposal.leadId, { action: "dismiss", kind: "colourway", ids });
    if (!json) return;
    toast.ok(t("dupes.cw.dismissed"));
    removeColourways(new Set([proposal.leadId]));
  };

  const dismiss = async (group: Group, ids: string[], against: string[]) => {
    const line = (id: string) => {
      const p = group.products.find((x) => x.id === id);
      return p ? cardLine(p) : `• ${id}`;
    };
    const list = (
      <ul>
        {ids.map((id) => (
          <li key={id}>{line(id)}</li>
        ))}
      </ul>
    );
    const question = against.length
      ? {
          title: t("dupes.confirm.dismissSome", { count: ids.length }),
          body: (
            <>
              {list}
              <p className="mt-2">{t("dupes.confirm.dismissSomeBody")}</p>
            </>
          ),
          confirmLabel: t("dupes.confirm.dismissAction", { count: ids.length }),
        }
      : {
          title: t("dupes.confirm.dismissAll"),
          body: (
            <>
              {list}
              <p className="mt-2">{t("dupes.confirm.dismissAllBody")}</p>
            </>
          ),
          confirmLabel: t("dupes.confirm.dismissAction", { count: ids.length }),
        };
    if (!(await confirm({ ...question, tone: "danger" }))) return;
    const json = await post(group.keepId, { action: "dismiss", ids, ...(against.length ? { against } : {}) });
    if (!json) return;
    if (!against.length) {
      toast.ok(t("dupes.dismissed"));
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
    toast.ok(t("dupes.dismissedSome", { count: ids.length }));
  };

  const mixed = report?.mixedGroups ?? [];
  const colourways = report?.colourways ?? [];
  const colorCount = mixed.length + colourways.length;
  const colorSummary = [
    mixed.length > 0 && t("dupes.summary.mixed", { count: mixed.length }),
    colourways.length > 0 && t("dupes.summary.colourways", { count: colourways.length }),
  ]
    .filter(Boolean)
    .join(" · ");
  // A few of the color groups' photos on the way to their tab (the mockup's peek).
  const peek = [...mixed.map((g) => g.families[0]?.[0]?.image), ...colourways.map((c) => c.products[0]?.image)]
    .filter((src): src is string => !!src)
    .slice(0, 4);

  const subtitle = report
    ? view === "colors"
      ? colorSummary || t("dupes.colors.empty")
      : [
          t("dupes.summary.items", { count: report.groups.length, cards }),
          t("dupes.summary.scanned", { count: report.scanned }),
        ].join(" · ")
    : loading
      ? t("dupes.scanning")
      : "—";

  // What keeps a dismissal from being remembered, in place of the banner.
  const attention: AttentionRow[] =
    report && !report.dismissalsAvailable
      ? [
          {
            key: "dismissals",
            tone: "warn",
            title: t("dupes.attn.dismissals.title"),
            text: t("dupes.attn.dismissals.text"),
            action: { label: t("attn.open.settings"), href: "/goo-studio/settings#schema" },
            fix: ["supabase/migrations/012_label_audit_dismissals.sql"],
          },
        ]
      : [];

  return (
    <div>
      <PageHeader
        title={t("nav.duplicates")}
        titleExtra={<HelpButton help={help} label={t("dupes.help.label")} />}
        subtitle={subtitle}
        actions={[{ key: "rescan", label: loading ? t("dupes.scanning") : t("dupes.rescan"), onClick: () => void load(), disabled: loading }]}
      />
      {help.open && (
        <div className="-mt-3 mb-6">
          <HelpPanel help={help}>
            {view === "colors" ? (
              <>
                <p>{t("dupes.help.mixed")}</p>
                <p>{t("dupes.help.colourways")}</p>
              </>
            ) : (
              <>
                <p>{t("dupes.help.found")}</p>
                <p>{t("dupes.help.merge")}</p>
              </>
            )}
          </HelpPanel>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {attention.length > 0 && <AttentionList rows={attention} />}

        {error && (
          <div role="alert" className="rounded-xl border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-3 text-[13px] text-[var(--err)]">
            {sayFailure(error, t)}
          </div>
        )}

        <Tabs
          label={t("dupes.tabs")}
          idBase="dupes"
          tabs={[
            { key: "duplicates", label: t("dupes.tab.duplicates"), count: report ? report.groups.length : undefined },
            { key: "colors", label: t("dupes.tab.colors"), count: report ? colorCount : undefined },
          ]}
          value={view}
          onChange={setView}
        />

        {loading && !report ? (
          <p className="px-4 py-12 text-center text-[13px] text-[var(--foreground-muted)]">{t("dupes.scanningCatalog")}</p>
        ) : view === "duplicates" ? (
          <div {...tabPanel("dupes", "duplicates")} className="flex flex-col gap-6">
            {report && report.groups.length === 0 && (
              <div className={PANEL}>
                <EmptyState text={t("dupes.empty")} />
              </div>
            )}
            {report?.groups.map((group) => (
              <GroupCard
                key={group.keepId}
                group={group}
                busy={busyGroup === group.keepId || !!groupingAll}
                onMerge={(keepId, mergeIds) => merge(group, keepId, mergeIds)}
                onDismiss={(ids, against) => dismiss(group, ids, against)}
              />
            ))}

            {/* The other tab, one click away, with what is waiting in it. */}
            {colorCount > 0 && (
              <div className={`${PANEL} overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setView("colors")}
                  className="flex w-full items-center gap-3 md:gap-4 px-4 md:px-5 py-3.5 text-left transition-colors hover:bg-[var(--fg-overlay-05)]"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="flex-shrink-0 text-[var(--foreground-muted)]">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] leading-5 font-medium text-[var(--foreground)]">{t("dupes.tab.colors")}</span>
                      <Badge>{f.number(colorCount)}</Badge>
                    </span>
                    <span className={`block ${MUTED}`}>{colorSummary}</span>
                  </span>
                  {peek.length > 0 && (
                    <span className="hidden md:flex gap-1.5" aria-hidden="true">
                      {peek.map((src, i) => (
                        <Thumb key={`${src}-${i}`} src={src} />
                      ))}
                    </span>
                  )}
                  <span className="flex-shrink-0 text-[13px] text-[var(--foreground-muted)]">{t("dupes.openTab")}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div {...tabPanel("dupes", "colors")} className="flex flex-col gap-8">
            {report && colorCount === 0 && (
              <div className={PANEL}>
                <EmptyState text={t("dupes.colors.empty")} />
              </div>
            )}

            {mixed.length > 0 && (
              <section aria-labelledby="dupes-mixed" className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h2 id="dupes-mixed" className={H2}>
                    {t("dupes.mixed.title")}
                  </h2>
                  <Badge>{f.number(mixed.length)}</Badge>
                </div>
                <div className="flex flex-col gap-5">
                  {mixed.map((group) => (
                    <MixedGroupCard
                      key={group.groupId}
                      group={group}
                      busy={busyGroup === group.groupId || !!groupingAll}
                      onSplit={(keepIds) => split(group, keepIds)}
                    />
                  ))}
                </div>
              </section>
            )}

            {colourways.length > 0 && (
              <section aria-labelledby="dupes-cw" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="dupes-cw" className={H2}>
                    {t("dupes.cw.title")}
                  </h2>
                  <Badge>{f.number(colourways.length)}</Badge>
                  <button
                    onClick={() => groupAllColours()}
                    disabled={!!groupingAll || !!busyGroup}
                    className={`ml-auto ${btn("primary")}`}
                  >
                    {groupingAll
                      ? t("dupes.cw.grouping", { done: groupingAll.done, total: groupingAll.total })
                      : t("dupes.cw.groupAll", { count: colourways.length })}
                  </button>
                </div>
                <div className="flex flex-col gap-5">
                  {colourways.map((proposal) => (
                    <ColourwayCard
                      key={proposal.leadId}
                      proposal={proposal}
                      busy={busyGroup === proposal.leadId || !!groupingAll}
                      onGroup={() => groupColours(proposal)}
                      onDismiss={() => dismissColours(proposal)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
