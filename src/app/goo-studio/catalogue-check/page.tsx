"use client";

/**
 * AI check — a cheap model reads every product record and fixes what
 * contradicts itself: a store's name where the brand should be, "NIKE" beside
 * "Nike", a size stored as the color, a hoodie filed under sneakers.
 *
 * It runs by itself after every import (and works through the back catalog
 * over time) under a monthly cap. This page is where it is set up, run over
 * the whole catalog, and where its work is reviewed: what it fixed, with
 * Undo, and what it was not sure enough to fix, with Apply and Dismiss.
 *
 * Laid out per docs/ADMIN_DESIGN.md and the "AI check" mockup (GS4-12): the
 * header with the numbers, what keeps the check from running as an attention
 * list (it was colored banners), the run and the settings side by side, the
 * fixes waiting for a person, the fixes made (folded), and the runs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { useToast } from "@/components/admin/Toast";
import { PageHeader } from "@/components/admin/PageHeader";
import { AttentionList, type AttentionRow } from "@/components/admin/AttentionList";
import { Badge } from "@/components/admin/Badge";
import { FilterChips } from "@/components/admin/FilterBar";
import { RowMenu } from "@/components/admin/Menu";
import { DataTable, EmptyState, type Column } from "@/components/admin/DataTable";
import { BANNER, btn, FIELD_LABEL, INPUT, PANEL, SELECT } from "@/app/goo-studio/_ui/recipes";
import { useSetting, writeSetting } from "@/app/goo-studio/_ui/settings";
import { useFormat, useT, type Key, type T, type Vars } from "@/app/goo-studio/_i18n";

type Mode = "off" | "suggest" | "auto";

interface Settings {
  mode: Mode;
  model: string;
  monthlyBudgetUsd: number;
  notes: string;
}

interface Fix {
  id: number;
  runId: string;
  productId: string;
  productName: string;
  brand: string;
  field: string;
  beforeText: string;
  afterText: string;
  writable: boolean;
  reason: string;
  confidence: string;
  status: string;
  source: string;
  createdAt: string;
}

interface Run {
  id: string;
  trigger: string;
  model: string;
  products: number;
  applied: number;
  suggested: number;
  failed: number;
  costUsd: number;
  startedAt: string;
}

interface Status {
  migrated: boolean;
  keyConfigured: boolean;
  settings: Settings;
  models: { id: string; label: string }[];
  counts: { products: number; unchecked: number; suggestions: number };
  spend: { autoThisMonth: number; totalThisMonth: number };
  estimate: { uncheckedUsd: number; allUsd: number };
  sweepPausedUntil: string | null;
  suggestions: Fix[];
  applied: Fix[];
  runs: Run[];
}

interface Line {
  id: string;
  name: string;
  applied: string[];
  suggested: string[];
  failed?: boolean;
}

/** What a brand step reported, kept as data so it reads in the admin's current language. */
type BrandNote =
  | { kind: "merge"; from: string; to: string; products: number; applied: boolean }
  | { kind: "notBrand"; value: string; products: number };

type Job = "unchecked" | "changed" | "all" | "brands";

/** A load failure: the server's own words, or a dictionary key. */
type Failure = string | { key: Key; vars?: Vars };

function sayFailure(f: Failure, t: T): string {
  return typeof f === "string" ? f : t(f.key, f.vars);
}

const JOB_KEY: Record<Job, Key> = {
  unchecked: "aicheck.job.unchecked",
  changed: "aicheck.job.changed",
  all: "aicheck.job.all",
  brands: "aicheck.job.brands",
};

// Off → Suggest → Auto: from doing nothing to writing by itself (the mockup's order).
const MODES: { id: Mode; label: Key; note: Key }[] = [
  { id: "off", label: "aicheck.mode.off", note: "aicheck.mode.offNote" },
  { id: "suggest", label: "aicheck.mode.suggest", note: "aicheck.mode.suggestNote" },
  { id: "auto", label: "aicheck.mode.auto", note: "aicheck.mode.autoNote" },
];

const FIELD_KEY: Record<string, Key> = {
  brand: "aicheck.field.brand",
  name: "aicheck.field.name",
  category: "aicheck.field.category",
  subcategory: "aicheck.field.subcategory",
  gender: "aicheck.field.gender",
  colors: "aicheck.field.colors",
  color_filters: "aicheck.field.color_filters",
  material: "aicheck.field.material",
  sizes: "aicheck.field.sizes",
  description: "aicheck.field.description",
  price: "aicheck.field.price",
};

/** A field's name in the admin's language; a field this page does not know shows as stored. */
function fieldName(field: string, t: T): string {
  return field in FIELD_KEY ? t(FIELD_KEY[field]) : field;
}

const DECIDED: Record<"apply" | "dismiss" | "undo", Key> = {
  apply: "aicheck.decided.apply",
  dismiss: "aicheck.decided.dismiss",
  undo: "aicheck.decided.undo",
};

const H2 = "text-[15px] leading-[22px] font-medium text-[var(--foreground)]";
const MUTED = "text-[12px] leading-[18px] text-[var(--foreground-muted)]";

/** Brand merges arrive as one fix per product; they are read and decided as one line. */
interface Group {
  key: string;
  fixes: Fix[];
}

function groupFixes(fixes: Fix[]): Group[] {
  const groups = new Map<string, Fix[]>();
  for (const f of fixes) {
    const key = f.source === "brand" ? `brand\u0000${f.runId}\u0000${f.beforeText}\u0000${f.afterText}` : `fix\u0000${f.id}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.entries()].map(([key, list]) => ({ key, fixes: list }));
}

/** Whether "Fixed by the check" is unfolded, remembered per browser like the help panels. */
const FIXED_OPEN_KEY = "goo-admin-aicheck-fixed";

export default function CatalogueCheckPage() {
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Failure | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState({ checked: 0, applied: 0, suggested: 0, failed: 0, cost: 0, brands: 0 });
  const [lines, setLines] = useState<Line[]>([]);
  const [brandNotes, setBrandNotes] = useState<BrandNote[]>([]);
  const stopRef = useRef(false);
  const confirm = useConfirm();
  const toast = useToast();
  // Costs and times through the admin's one format (GS4-6). Below a dime a
  // cost gets three places, so a column of runs reads $0.010 / $0.005.
  const f = useFormat();
  const usd = (n: number) => f.money(n || 0);
  const when = f.dateTime;
  const runKind = (r: Run) =>
    t(r.trigger === "auto" ? "aicheck.kind.auto" : r.trigger === "brands" ? "aicheck.kind.brands" : "aicheck.kind.manual");
  const help = useHelp("catalogue-check");
  const fixedOpen = useSetting(FIXED_OPEN_KEY) === "open";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/catalogue-check", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? { key: "aicheck.loadFailed" });
      } else {
        setError(null);
        setStatus(json);
        setDraft((d) => d ?? json.settings);
      }
    } catch {
      setError({ key: "aicheck.unreachable" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/catalogue-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? t("aicheck.requestFailed", { status: res.status }));
    return json;
  };

  const saveSettings = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const json = await post({ action: "settings", ...draft });
      setDraft(json.settings);
      toast.ok(t("aicheck.settings.saved"));
      void load();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("aicheck.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  /** Walk the catalog a step at a time until it is done or Stop is pressed. */
  const run = async (which: Job) => {
    if (which === "all" && status) {
      const ok = await confirm({
        title: t("aicheck.confirm.all", { count: status.counts.products }),
        body: t("aicheck.confirm.allBody", { cost: usd(status.estimate.allUsd) }),
        confirmLabel: t("aicheck.confirm.allAction", { count: status.counts.products }),
      });
      if (!ok) return;
    }
    stopRef.current = false;
    setJob(which);
    setProgress({ checked: 0, applied: 0, suggested: 0, failed: 0, cost: 0, brands: 0 });
    setLines([]);
    setBrandNotes([]);
    let cursor: string | null = null;
    let runId: string | null = null;
    let failures = 0;
    try {
      for (;;) {
        if (stopRef.current) break;
        let json;
        try {
          json = await post(which === "brands" ? { action: "brands", cursor, runId } : { action: "run", scope: which, cursor, runId });
          failures = 0;
        } catch (e) {
          failures++;
          if (failures >= 3) throw e;
          continue;
        }
        runId = json.runId;
        if (which === "brands") {
          const merges = json.merges as { from: string; to: string; products: number; applied: boolean }[];
          const not = json.notBrands as { value: string; products: number }[];
          setProgress((p) => ({
            ...p,
            brands: p.brands + (json.reviewed ?? 0),
            applied: p.applied + merges.filter((m) => m.applied).reduce((n, m) => n + m.products, 0),
            suggested: p.suggested + merges.filter((m) => !m.applied).reduce((n, m) => n + m.products, 0),
            cost: p.cost + (json.usage?.costUsd ?? 0),
          }));
          setBrandNotes((prev) => [
            ...prev,
            ...merges.map((m): BrandNote => ({ kind: "merge", from: m.from, to: m.to, products: m.products, applied: m.applied })),
            ...not.map((n): BrandNote => ({ kind: "notBrand", value: n.value, products: n.products })),
          ]);
        } else {
          if (json.error) throw new Error(json.error);
          setProgress((p) => ({
            ...p,
            checked: p.checked + (json.checked ?? 0),
            applied: p.applied + (json.applied ?? 0),
            suggested: p.suggested + (json.suggested ?? 0),
            failed: p.failed + (json.failed ?? 0),
            cost: p.cost + (json.usage?.costUsd ?? 0),
          }));
          setLines((prev) => [...(json.lines as Line[]).filter((l) => l.applied.length || l.suggested.length || l.failed), ...prev].slice(0, 200));
        }
        cursor = json.cursor;
        if (!cursor) break;
      }
      toast.ok(t(stopRef.current ? "aicheck.stopped" : "aicheck.done"));
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("aicheck.runFailed"));
    } finally {
      setJob(null);
      void load();
    }
  };

  const decide = async (key: string, ids: number[], action: "apply" | "dismiss" | "undo") => {
    setBusy(key);
    try {
      const json = await post({ action, ids });
      const done = t(DECIDED[action], { count: json.done });
      const msg = json.stale
        ? `${done} ${t("aicheck.decided.stale", { count: json.stale })}`
        : json.errors?.length
        ? json.errors[0]
        : done;
      if (json.stale || json.errors?.length) toast.err(msg);
      else toast.ok(msg);
      void load();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("aicheck.saveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const undoRun = async (r: Run) => {
    if (
      !(await confirm({
        title: t("aicheck.confirm.undoRun", { count: r.applied }),
        body: t("aicheck.confirm.undoRunBody"),
        confirmLabel: t("aicheck.confirm.undoRunAction", { count: r.applied }),
        tone: "danger",
      }))
    )
      return;
    setBusy(`run:${r.id}`);
    try {
      const json = await post({ action: "undo_run", runId: r.id });
      const done = t("aicheck.decided.undo", { count: json.done });
      toast.ok(json.stale ? `${done} ${t("aicheck.undoRun.stale", { count: json.stale })}` : done);
      void load();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("aicheck.undoFailed"));
    } finally {
      setBusy(null);
    }
  };

  const suggestionGroups = useMemo(() => groupFixes(status?.suggestions ?? []), [status]);
  const appliedGroups = useMemo(() => groupFixes(status?.applied ?? []), [status]);
  const writableSuggestions = (status?.suggestions ?? []).filter((f) => f.writable).map((f) => f.id);

  const ready = !!status?.migrated && !!status?.keyConfigured;
  const checked = status ? status.counts.products - status.counts.unchecked : 0;
  // Floored, so a catalog with anything left unchecked never reads 100%.
  const pct = status?.counts.products ? Math.floor((checked / status.counts.products) * 100) : 0;
  const settingsChanged = !!draft && !!status && JSON.stringify(draft) !== JSON.stringify(status.settings);
  const lastRun = status?.runs[0];
  const fieldList = (fields: string[]) => fields.map((x) => fieldName(x, t)).join(", ");

  // What keeps the check from running, in place of the colored banners.
  const attention: AttentionRow[] = [];
  if (status && !status.migrated) {
    attention.push({
      key: "migration",
      tone: "err",
      title: t("aicheck.attn.migration.title"),
      text: t("aicheck.attn.migration.text"),
      action: { label: t("attn.open.settings"), href: "/goo-studio/settings#schema" },
      fix: ["supabase/migrations/025_catalogue_check.sql"],
    });
  }
  if (status && !status.keyConfigured) {
    attention.push({
      key: "key",
      tone: "err",
      title: t("aicheck.attn.noKey.title"),
      text: t("aicheck.attn.noKey.text"),
      action: { label: t("attn.open.settings"), href: "/goo-studio/settings#openai" },
      fix: ["OPENAI_API_KEY"],
    });
  }
  if (status?.sweepPausedUntil && status.migrated && status.keyConfigured) {
    attention.push({
      key: "paused",
      tone: "warn",
      title: t("aicheck.attn.paused.title", { when: when(status.sweepPausedUntil) }),
      text:
        status.spend.autoThisMonth >= status.settings.monthlyBudgetUsd
          ? t("aicheck.attn.paused.cap", { spent: usd(status.spend.autoThisMonth), cap: usd(status.settings.monthlyBudgetUsd) })
          : t("aicheck.attn.paused.error"),
    });
  }

  const runColumns: Column<Run>[] = [
    { key: "started", header: t("aicheck.runs.col.started"), cell: (r) => when(r.startedAt) },
    { key: "kind", header: t("aicheck.runs.col.kind"), cell: (r) => <span className="text-[var(--foreground-muted)]">{runKind(r)}</span> },
    {
      key: "model",
      header: t("aicheck.runs.col.model"),
      grow: true,
      cell: (r) => <span className="block truncate text-[var(--foreground-muted)]">{r.model}</span>,
    },
    { key: "products", header: t("aicheck.runs.col.products"), align: "right", cell: (r) => f.number(r.products) },
    { key: "fixed", header: t("aicheck.runs.col.fixed"), align: "right", cell: (r) => f.number(r.applied) },
    { key: "suggested", header: t("aicheck.runs.col.forYou"), align: "right", cell: (r) => f.number(r.suggested) },
    { key: "cost", header: t("aicheck.runs.col.cost"), align: "right", cell: (r) => usd(r.costUsd) },
  ];

  const subtitle = status
    ? [
        t("aicheck.summary.checked", { checked, count: status.counts.products }),
        t("aicheck.summary.waiting", { count: status.counts.suggestions }),
        t("aicheck.summary.spent", { amount: usd(status.spend.totalThisMonth) }),
      ].join(" · ")
    : loading
    ? t("common.loading")
    : "—";

  return (
    <div>
      <PageHeader
        title={t("nav.catalogueCheck")}
        titleExtra={<HelpButton help={help} label={t("aicheck.help.label")} />}
        subtitle={subtitle}
        actions={[
          { key: "refresh", label: loading ? t("common.loading") : t("aicheck.refresh"), onClick: () => void load(), disabled: loading || !!job },
        ]}
      />
      {help.open && (
        <div className="-mt-3 mb-6">
          <HelpPanel help={help}>
            <p>{t("aicheck.help.p1")}</p>
            <p>{t("aicheck.help.p2")}</p>
          </HelpPanel>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {error && (
          <div role="alert" className={BANNER.err}>
            {sayFailure(error, t)}
          </div>
        )}

        {attention.length > 0 && <AttentionList rows={attention} />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Run */}
          <section aria-labelledby="aicheck-run" className={`${PANEL} flex flex-col gap-4 p-4 md:p-5`}>
            <div>
              <h2 id="aicheck-run" className={H2}>
                {t("aicheck.run.title")}
              </h2>
              <p className={`mt-1 ${MUTED}`}>{t("aicheck.run.text")}</p>
            </div>

            {status && (
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-[28px] leading-8 font-light tabular-nums text-[var(--foreground)]">
                    {t("aicheck.run.pct", { pct })}
                  </span>
                  <span className="text-[13px] text-[var(--foreground-muted)]">
                    {t("aicheck.run.progress", { checked, count: status.counts.products })}
                    {status.counts.unchecked > 0 && ` · ${t("aicheck.run.never", { count: status.counts.unchecked })}`}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t("aicheck.run.progressLabel")}
                  className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-[var(--fg-overlay-08)]"
                >
                  <div className="h-full bg-[var(--foreground)]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => run("unchecked")} disabled={!ready || !!job || !status?.counts.unchecked} className={btn("primary")}>
                  {t("aicheck.run.unchecked", { count: status?.counts.unchecked ?? 0, cost: usd(status?.estimate.uncheckedUsd ?? 0) })}
                </button>
                <button onClick={() => run("brands")} disabled={!ready || !!job} className={btn("secondary")} title={t("aicheck.run.brandsHint")}>
                  {t("aicheck.run.brands")}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1 -ml-3">
                <button onClick={() => run("changed")} disabled={!ready || !!job} className={btn("ghost")} title={t("aicheck.run.changedHint")}>
                  {t("aicheck.run.changed")}
                </button>
                <button onClick={() => run("all")} disabled={!ready || !!job} className={btn("ghost")}>
                  {t("aicheck.run.all", { cost: usd(status?.estimate.allUsd ?? 0) })}
                </button>
              </div>
            </div>

            {(job || lines.length > 0 || brandNotes.length > 0) && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] leading-[18px] text-[var(--foreground)]" role="status">
                    {job ? t(JOB_KEY[job]) : t("aicheck.job.last")}{" "}
                    {job === "brands" || (!job && brandNotes.length > 0)
                      ? t("aicheck.progress.brands", {
                          brands: progress.brands,
                          count: progress.applied,
                          suggested: progress.suggested,
                          cost: usd(progress.cost),
                        })
                      : t("aicheck.progress.records", {
                          checked: progress.checked,
                          applied: progress.applied,
                          suggested: progress.suggested,
                          failed: progress.failed,
                          cost: usd(progress.cost),
                        })}
                  </p>
                  {job && (
                    <button
                      onClick={() => {
                        stopRef.current = true;
                      }}
                      className={btn("ghost", "sm")}
                    >
                      {t("aicheck.stop")}
                    </button>
                  )}
                </div>
                <ul className="mt-2 max-h-56 overflow-y-auto">
                  {brandNotes.map((n, i) => (
                    <li key={`b${i}`} className={`py-0.5 ${MUTED}`}>
                      {n.kind === "merge"
                        ? t("aicheck.note.merge", {
                            from: n.from,
                            to: n.to,
                            count: n.products,
                            state: t(n.applied ? "aicheck.note.fixed" : "aicheck.note.waiting"),
                          })
                        : t("aicheck.note.notBrand", { value: n.value, count: n.products })}
                    </li>
                  ))}
                  {lines.map((l) => (
                    <li key={l.id} className={`py-0.5 ${MUTED}`}>
                      <span className="text-[var(--foreground)]">{l.name || t("aicheck.noName")}</span>
                      {l.failed && ` — ${t("aicheck.line.failed")}`}
                      {l.applied.length > 0 && ` — ${t("aicheck.line.fixed", { fields: fieldList(l.applied) })}`}
                      {l.suggested.length > 0 && ` — ${t("aicheck.line.forYou", { fields: fieldList(l.suggested) })}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className={`mt-auto pt-3.5 border-t border-[var(--border)] ${MUTED}`}>
              {t("aicheck.run.note")}
              {lastRun &&
                ` ${t("aicheck.run.last", { when: when(lastRun.startedAt), kind: runKind(lastRun), count: lastRun.products })}`}
            </p>
          </section>

          {/* Settings */}
          <section aria-labelledby="aicheck-settings" className={`${PANEL} flex flex-col gap-4 p-4 md:p-5`}>
            <h2 id="aicheck-settings" className={H2}>
              {t("aicheck.settings.title")}
            </h2>
            {draft && status && (
              <>
                <div>
                  <span className={FIELD_LABEL}>{t("aicheck.settings.mode")}</span>
                  <FilterChips
                    label={t("aicheck.settings.mode")}
                    value={draft.mode}
                    options={MODES.map((m) => ({ value: m.id, label: t(m.label) }))}
                    onChange={(v) => setDraft({ ...draft, mode: v as Mode })}
                  />
                  <p className={`mt-1.5 ${MUTED}`}>{t(MODES.find((m) => m.id === draft.mode)?.note ?? "aicheck.mode.offNote")}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className={FIELD_LABEL}>{t("aicheck.settings.model")}</span>
                    <select value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} className={`w-full ${SELECT}`}>
                      {status.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={FIELD_LABEL}>{t("aicheck.settings.cap")}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={draft.monthlyBudgetUsd}
                      onChange={(e) => setDraft({ ...draft, monthlyBudgetUsd: Number(e.target.value) })}
                      className={`w-full tabular-nums ${INPUT}`}
                    />
                  </label>
                </div>
                <p className={`-mt-2 ${MUTED}`}>
                  {t("aicheck.settings.spend", { spent: usd(status.spend.autoThisMonth), cap: usd(status.settings.monthlyBudgetUsd) })}
                </p>
                <label className="block">
                  <span className={FIELD_LABEL}>{t("aicheck.settings.rules")}</span>
                  <textarea
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    rows={3}
                    maxLength={2000}
                    placeholder={t("aicheck.settings.rulesPlaceholder")}
                    className={`w-full resize-y ${INPUT}`}
                  />
                </label>
                <div className="flex justify-end">
                  <button onClick={saveSettings} disabled={saving || !settingsChanged} className={btn("secondary")}>
                    {saving ? t("common.saving") : t("aicheck.settings.save")}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Waiting for a person */}
        {status?.migrated && (
          <section aria-labelledby="aicheck-waiting" className={`${PANEL} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 py-3.5 border-b border-[var(--border)]">
              <h2 id="aicheck-waiting" className={H2}>
                {t("aicheck.waiting.title")}
              </h2>
              {status.counts.suggestions > 0 && <Badge tone="warn">{f.number(status.counts.suggestions)}</Badge>}
              {writableSuggestions.length > 1 && (
                <button
                  onClick={async () => {
                    if (
                      await confirm({
                        title: t("aicheck.confirm.applyAll", { count: writableSuggestions.length }),
                        body: t("aicheck.confirm.applyAllBody"),
                        confirmLabel: t("aicheck.confirm.applyAllAction", { count: writableSuggestions.length }),
                      })
                    ) {
                      void decide("all", writableSuggestions, "apply");
                    }
                  }}
                  disabled={busy !== null || !!job}
                  className={`ml-auto ${btn("secondary")}`}
                >
                  {t("aicheck.waiting.applyAll", { count: writableSuggestions.length })}
                </button>
              )}
            </div>
            {suggestionGroups.length === 0 ? (
              <EmptyState text={t("aicheck.waiting.empty")} />
            ) : (
              <ul>
                {suggestionGroups.map((g) => (
                  <FixRow key={g.key} group={g} busy={busy} disabled={!!job} onDecide={decide} kind="suggestion" />
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Fixed by the check: folded, as in the mockup; the header says how many. */}
        {status?.migrated && (
          <section className={`${PANEL} overflow-hidden`}>
            <h2>
              <button
                type="button"
                onClick={() => writeSetting(FIXED_OPEN_KEY, fixedOpen ? null : "open")}
                aria-expanded={fixedOpen}
                aria-controls="aicheck-fixed"
                className="flex w-full items-center gap-3 px-4 md:px-5 py-3.5 text-left transition-colors hover:bg-[var(--fg-overlay-05)]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                  className={`flex-shrink-0 text-[var(--foreground-muted)] transition-transform ${fixedOpen ? "rotate-90" : ""}`}
                >
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className={H2}>{t("aicheck.fixed.title")}</span>
                    {status.applied.length > 0 && <Badge>{f.number(status.applied.length)}</Badge>}
                  </span>
                  <span className={`block ${MUTED}`}>{t("aicheck.fixed.text", { count: status.applied.length })}</span>
                </span>
              </button>
            </h2>
            {fixedOpen && (
              <div id="aicheck-fixed" className="border-t border-[var(--border)]">
                {appliedGroups.length === 0 ? (
                  <EmptyState text={t("aicheck.fixed.empty")} />
                ) : (
                  <ul>
                    {appliedGroups.map((g) => (
                      <FixRow key={g.key} group={g} busy={busy} disabled={!!job} onDecide={decide} kind="applied" />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {/* Runs */}
        {status?.migrated && status.runs.length > 0 && (
          <section aria-labelledby="aicheck-runs" className="flex flex-col gap-3">
            <h2 id="aicheck-runs" className={H2}>
              {t("aicheck.runs.title")}
            </h2>
            <DataTable
              label={t("aicheck.runs.title")}
              rows={status.runs}
              rowKey={(r) => String(r.id)}
              columns={runColumns}
              card={(r) => ({
                title: `${when(r.startedAt)} · ${runKind(r)}`,
                meta: t("aicheck.runs.card", { count: r.products, fixed: r.applied, forYou: r.suggested, cost: usd(r.costUsd) }),
              })}
              actions={(r) =>
                r.applied > 0 ? (
                  <RowMenu
                    size="sm"
                    label={t("menu.moreFor", { name: `${when(r.startedAt)} · ${runKind(r)}` })}
                    items={[
                      {
                        label: t("aicheck.runs.undo", { count: r.applied }),
                        onSelect: () => void undoRun(r),
                        disabled: busy !== null || !!job,
                      },
                    ]}
                  />
                ) : null
              }
            />
          </section>
        )}
      </div>
    </div>
  );
}

function FixRow({
  group,
  busy,
  disabled,
  onDecide,
  kind,
}: {
  group: Group;
  busy: string | null;
  disabled: boolean;
  onDecide: (key: string, ids: number[], action: "apply" | "dismiss" | "undo") => void;
  kind: "suggestion" | "applied";
}) {
  const t = useT();
  const f = group.fixes[0];
  const ids = group.fixes.map((x) => x.id);
  const many = group.fixes.length > 1;
  const isBusy = busy === group.key;
  const before = f.beforeText || t("aicheck.fix.none");
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 md:px-5 py-3 border-t border-[var(--border)] first:border-t-0">
      <div className="flex-[1_1_420px] min-w-0">
        {many ? (
          <div className="text-[13px] leading-5 font-medium text-[var(--foreground)]">
            {t("aicheck.fix.group", { count: group.fixes.length, brand: f.beforeText })}
          </div>
        ) : (
          <Link
            href={`/goo-studio/products?search=${encodeURIComponent(f.productName)}`}
            className="text-[13px] leading-5 font-medium text-[var(--foreground)] hover:underline underline-offset-2"
          >
            {f.productName || t("aicheck.noName")}
          </Link>
        )}
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[13px] leading-5 break-words">
          <span className="text-[12px] font-medium text-[var(--foreground-muted)]">{fieldName(f.field, t)}:</span>
          {f.writable ? (
            <>
              <span className="text-[var(--foreground-muted)] line-through">{before}</span>
              <span className="text-[var(--foreground-muted)]">→</span>
              <span className="font-medium text-[var(--foreground)]">{f.afterText || t("aicheck.fix.none")}</span>
            </>
          ) : (
            <span className="text-[var(--foreground)]">{before}</span>
          )}
          {f.confidence === "high" && kind === "suggestion" && (
            <span className="self-center">
              <Badge tone="ok">{t("aicheck.fix.sure")}</Badge>
            </span>
          )}
        </div>
        {f.reason && <p className="text-[12px] leading-[18px] text-[var(--foreground-muted)]">{f.reason}</p>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1 ml-auto">
        {kind === "suggestion" ? (
          <>
            <button
              onClick={() => onDecide(group.key, ids, "dismiss")}
              disabled={isBusy || disabled}
              title={t("aicheck.fix.dismissHint")}
              className={btn("ghost")}
            >
              {t("aicheck.fix.dismiss")}
            </button>
            {f.writable ? (
              <button onClick={() => onDecide(group.key, ids, "apply")} disabled={isBusy || disabled} className={btn("secondary")}>
                {isBusy ? "…" : many ? t("aicheck.fix.applyN", { count: ids.length }) : t("aicheck.fix.apply")}
              </button>
            ) : (
              <Link
                href={`/goo-studio/products?search=${encodeURIComponent(many ? f.beforeText : f.productName)}`}
                className={`min-h-10 md:min-h-0 ${btn("secondary")}`}
              >
                {t("aicheck.fix.edit")}
              </Link>
            )}
          </>
        ) : (
          <button
            onClick={() => onDecide(group.key, ids, "undo")}
            disabled={isBusy || disabled}
            title={t("aicheck.fix.undoHint")}
            className={btn("ghost")}
          >
            {isBusy ? "…" : many ? t("aicheck.fix.undoN", { count: ids.length }) : t("aicheck.fix.undo")}
          </button>
        )}
      </div>
    </li>
  );
}
