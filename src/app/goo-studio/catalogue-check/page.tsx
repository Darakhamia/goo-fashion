"use client";

/**
 * AI check — a cheap model reads every product record and fixes what
 * contradicts itself: a store's name where the brand should be, "NIKE" beside
 * "Nike", a size stored as the colour, a hoodie filed under sneakers.
 *
 * It runs by itself after every import (and works through the back catalogue
 * over time) under a monthly cap. This page is where it is set up, run over
 * the whole catalogue, and where its work is reviewed: what it fixed, with
 * Undo, and what it was not sure enough to fix, with Apply and Dismiss.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { useToast } from "@/components/admin/Toast";
import { btn } from "@/app/goo-studio/_ui/recipes";
import { useFormat } from "@/app/goo-studio/_i18n";

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

type Job = "unchecked" | "changed" | "all" | "brands";

const JOB_LABEL: Record<Job, string> = {
  unchecked: "Checking unchecked products",
  changed: "Re-checking changed products",
  all: "Re-checking every product",
  brands: "Reviewing brand spellings",
};

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "auto", label: "Auto-fix", note: "Fixes the record proves are written at once; the rest wait here." },
  { id: "suggest", label: "Suggest only", note: "Nothing is written until you press Apply." },
  { id: "off", label: "Off", note: "Nothing runs by itself. Runs from this page still fix what the record proves." },
];

const FIELD_LABEL: Record<string, string> = {
  brand: "Brand",
  name: "Name",
  category: "Category",
  subcategory: "Subcategory",
  gender: "Gender",
  colors: "Colours",
  color_filters: "Colour filters",
  material: "Material",
  sizes: "Sizes",
  description: "Description",
  price: "Price",
};

// Field base without a background, so the input and the select each set one.
const fieldBase =
  "w-full rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";
const inputClass = `${fieldBase} bg-transparent`;
const selectClass = `${fieldBase} bg-[var(--surface)]`;
const labelClass = "block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}


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

export default function CatalogueCheckPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState({ checked: 0, applied: 0, suggested: 0, failed: 0, cost: 0, brands: 0 });
  const [lines, setLines] = useState<Line[]>([]);
  const [brandNotes, setBrandNotes] = useState<string[]>([]);
  const stopRef = useRef(false);
  const confirm = useConfirm();
  const toast = useToast();
  // Costs and times through the admin's one format (GS4-6). Below a dime a
  // cost gets three places, so a column of runs reads $0.010 / $0.005.
  const f = useFormat();
  const usd = (n: number) => f.money(n || 0);
  const when = f.dateTime;
  const help = useHelp("catalogue-check");
  const runHelp = useHelp("catalogue-check-run");
  const fixedHelp = useHelp("catalogue-check-fixed");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/catalogue-check", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load the AI check.");
      } else {
        setError(null);
        setStatus(json);
        setDraft((d) => d ?? json.settings);
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

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/catalogue-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
    return json;
  };

  const saveSettings = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const json = await post({ action: "settings", ...draft });
      setDraft(json.settings);
      toast.ok("Settings saved");
      void load();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  /** Walk the catalogue a step at a time until it is done or Stop is pressed. */
  const run = async (which: Job) => {
    if (which === "all" && status) {
      const ok = await confirm({
        title: `Re-check all ${status.counts.products} products?`,
        body: `Estimated cost about ${usd(status.estimate.allUsd)}. Fixes you undid or dismissed are not made again.`,
        confirmLabel: `Re-check ${status.counts.products} products`,
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
            ...merges.map((m) => `${m.from} → ${m.to} · ${plural(m.products, "product")} · ${m.applied ? "fixed" : "waiting for you"}`),
            ...not.map((n) => `“${n.value}” is not a brand · ${plural(n.products, "product")} sent back to the record check`),
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
      toast.ok(stopRef.current ? "Stopped" : "Done");
    } catch (e) {
      toast.err(e instanceof Error ? e.message : "The run stopped.");
    } finally {
      setJob(null);
      void load();
    }
  };

  const decide = async (key: string, ids: number[], action: "apply" | "dismiss" | "undo") => {
    setBusy(key);
    try {
      const json = await post({ action, ids });
      const verb = action === "apply" ? "Applied" : action === "dismiss" ? "Dismissed" : "Undone";
      const msg = json.stale
        ? `${verb} ${json.done}; ${json.stale} changed since the check — edit by hand`
        : json.errors?.length
        ? json.errors[0]
        : `${verb} ${json.done}`;
      if (json.stale || json.errors?.length) toast.err(msg);
      else toast.ok(msg);
      void load();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  };

  const undoRun = async (r: Run) => {
    const fixes = `${r.applied} fix${r.applied === 1 ? "" : "es"}`;
    if (
      !(await confirm({
        title: `Undo the ${fixes} this run made?`,
        body: "Products edited since are left as they are.",
        confirmLabel: `Undo ${fixes}`,
        tone: "danger",
      }))
    )
      return;
    setBusy(`run:${r.id}`);
    try {
      const json = await post({ action: "undo_run", runId: r.id });
      toast.ok(json.stale ? `Undone ${json.done}; ${json.stale} changed since — left as they are` : `Undone ${json.done}`);
      void load();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : "Could not undo.");
    } finally {
      setBusy(null);
    }
  };

  const suggestionGroups = useMemo(() => groupFixes(status?.suggestions ?? []), [status]);
  const appliedGroups = useMemo(() => groupFixes(status?.applied ?? []), [status]);
  const writableSuggestions = (status?.suggestions ?? []).filter((f) => f.writable).map((f) => f.id);

  const ready = !!status?.migrated && !!status?.keyConfigured;
  const checked = status ? status.counts.products - status.counts.unchecked : 0;
  const settingsChanged = !!draft && !!status && JSON.stringify(draft) !== JSON.stringify(status.settings);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-light text-[var(--foreground)]">AI check</h1>
            <HelpButton help={help} label="How AI check works" />
          </div>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
            {status
              ? `${checked} of ${status.counts.products} products checked · ${status.counts.suggestions} waiting for you · ${usd(status.spend.totalThisMonth)} spent this month`
              : "Loading…"}
          </p>
          {help.open && (
            <div className="mt-3">
              <HelpPanel help={help}>
                <p>
                  The model sees each product record as it is stored — name, brand, category, gender, colours, material, sizes, description,
                  price and store links — next to the catalogue&apos;s brand spellings and category tree. It cannot write to the database: it
                  answers, and the server writes only what the record itself backs. A brand must be named in the record or already be one of
                  ours; a colour or a material must be named in its text; a name, description or size list can only lose words. Prices are
                  never changed, only flagged.
                </p>
              </HelpPanel>
            </div>
          )}
        </div>
        <button onClick={() => load()} disabled={loading || !!job} className={btn("secondary")}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-3 text-xs text-[var(--err)]">
          {error}
        </div>
      )}
      {status && !status.migrated && (
        <div className="mb-6 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3">
          <p className="text-[13px] text-[var(--warn)] leading-relaxed">
            Run supabase/migrations/025_catalogue_check.sql in the Supabase SQL editor first. Until then the check has nowhere to
            record what it changed, so it does not run at all.
          </p>
        </div>
      )}
      {status && !status.keyConfigured && (
        <div className="mb-6 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3">
          <p className="text-[13px] text-[var(--warn)] leading-relaxed">
            No OpenAI key. Add one under <Link href="/goo-studio/settings" className="underline">Settings</Link> or set
            OPENAI_API_KEY — the check uses the same key as the parser.
          </p>
        </div>
      )}
      {status?.sweepPausedUntil && status.migrated && status.keyConfigured && (
        <div className="mb-6 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3">
          <p className="text-[13px] text-[var(--warn)] leading-relaxed">
            The background check is paused until {when(status.sweepPausedUntil)}
            {status.spend.autoThisMonth >= status.settings.monthlyBudgetUsd
              ? ` — it has spent its monthly cap (${usd(status.spend.autoThisMonth)} of ${usd(status.settings.monthlyBudgetUsd)}). Raise the cap below or run it from this page.`
              : " after an error reaching the model. Runs from this page still work."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Run */}
        <section className="rounded-xl border border-[var(--border)] p-4 md:p-5" style={{ background: "var(--surface)" }}>
          <div className="flex items-center gap-1">
            <h2 className="text-sm text-[var(--foreground)]">Check the catalogue</h2>
            <HelpButton help={runHelp} label="How checking the catalogue works" />
          </div>
          {runHelp.open && (
            <div className="mt-2">
              <HelpPanel help={runHelp}>
                <p>
                  New products are checked by themselves after every import. Here you run it over everything at once. A product is only
                  sent to the model again when it has changed since its last check.
                </p>
              </HelpPanel>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => run("unchecked")} disabled={!ready || !!job || !status?.counts.unchecked} className={btn("primary")}>
              Check unchecked ({status?.counts.unchecked ?? 0}) · ~{usd(status?.estimate.uncheckedUsd ?? 0)}
            </button>
            <button onClick={() => run("brands")} disabled={!ready || !!job} className={btn("secondary")} title="Find one brand spelled several ways and unify it">
              Unify brand spellings
            </button>
            <button onClick={() => run("changed")} disabled={!ready || !!job} className={btn("secondary")} title="Products edited or re-collected since their last check">
              Re-check changed
            </button>
            <button onClick={() => run("all")} disabled={!ready || !!job} className={btn("secondary")}>
              Re-check everything · ~{usd(status?.estimate.allUsd ?? 0)}
            </button>
          </div>

          {(job || lines.length > 0 || brandNotes.length > 0) && (
            <div className="mt-4 rounded-lg border border-[var(--border)] px-3 py-3" style={{ background: "var(--background)" }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-[var(--foreground)]" role="status">
                  {job ? `${JOB_LABEL[job]}… ` : "Last run: "}
                  {job === "brands" || (!job && brandNotes.length > 0)
                    ? `${progress.brands} brand values · ${plural(progress.applied, "product")} fixed · ${progress.suggested} waiting · ${usd(progress.cost)}`
                    : `${progress.checked} checked · ${progress.applied} fixed · ${progress.suggested} waiting · ${progress.failed} not answered · ${usd(progress.cost)}`}
                </p>
                {job && (
                  <button
                    onClick={() => {
                      stopRef.current = true;
                    }}
                    className={btn("ghost")}
                  >
                    Stop
                  </button>
                )}
              </div>
              <ul className="mt-2 max-h-56 overflow-y-auto">
                {brandNotes.map((n, i) => (
                  <li key={`b${i}`} className="text-[11px] text-[var(--foreground-muted)] py-0.5">
                    {n}
                  </li>
                ))}
                {lines.map((l) => (
                  <li key={l.id} className="text-[11px] text-[var(--foreground-muted)] py-0.5">
                    <span className="text-[var(--foreground)]">{l.name || "(no name)"}</span>
                    {l.failed && " — not answered, stays unchecked"}
                    {l.applied.length > 0 && ` — fixed ${l.applied.map((f) => FIELD_LABEL[f] ?? f).join(", ")}`}
                    {l.suggested.length > 0 && ` — for you: ${l.suggested.map((f) => FIELD_LABEL[f] ?? f).join(", ")}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Settings */}
        <section className="rounded-xl border border-[var(--border)] p-4 md:p-5" style={{ background: "var(--surface)" }}>
          <h2 className="text-sm text-[var(--foreground)]">Settings</h2>
          {draft && status && (
            <div className="mt-3 flex flex-col gap-4">
              <div>
                <span className={labelClass}>After each import</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mode">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      role="radio"
                      aria-checked={draft.mode === m.id}
                      onClick={() => setDraft({ ...draft, mode: m.id })}
                      className={`px-2.5 py-1 text-[12px] border rounded-full transition-colors ${
                        draft.mode === m.id
                          ? "bg-[var(--foreground)] text-[var(--surface)] border-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--foreground-muted)] mt-1.5">{MODES.find((m) => m.id === draft.mode)?.note}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>Model</span>
                  <select
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                    className={selectClass}
                  >
                    {status.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Monthly cap, background ($)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={draft.monthlyBudgetUsd}
                    onChange={(e) => setDraft({ ...draft, monthlyBudgetUsd: Number(e.target.value) })}
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="text-[11px] text-[var(--foreground-muted)] -mt-2">
                Background checks spent {usd(status.spend.autoThisMonth)} of {usd(status.settings.monthlyBudgetUsd)} this month. Runs
                from this page are not capped — the estimate is on each button.
              </p>
              <label className="block">
                <span className={labelClass}>House rules for the model</span>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={3}
                  maxLength={2000}
                  placeholder={"e.g. Carhartt WIP and Carhartt are one brand: use “Carhartt WIP”.\nNames are in English title case."}
                  className={`${inputClass} resize-y`}
                />
              </label>
              <div>
                <button onClick={saveSettings} disabled={saving || !settingsChanged} className={btn("primary")}>
                  {saving ? "Saving…" : "Save settings"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Waiting for a person */}
      {status?.migrated && (
        <section className="rounded-xl border border-[var(--border)] mb-5" style={{ background: "var(--surface)" }}>
          <header className="px-5 py-3.5 border-b border-[var(--border)] flex flex-wrap items-center gap-2">
            <h2 className="text-sm text-[var(--foreground)]">Waiting for you</h2>
            <span className="text-[12px] text-[var(--foreground-muted)]">{status.counts.suggestions}</span>
            {writableSuggestions.length > 1 && (
              <button
                onClick={async () => {
                  if (
                    await confirm({
                      title: `Apply all ${writableSuggestions.length} suggestions shown?`,
                      body: "Each is checked against the product first.",
                      confirmLabel: `Apply ${writableSuggestions.length} fixes`,
                    })
                  ) {
                    void decide("all", writableSuggestions, "apply");
                  }
                }}
                disabled={busy !== null || !!job}
                className={`${btn("primary")} ml-auto`}
              >
                Apply all {writableSuggestions.length}
              </button>
            )}
          </header>
          {suggestionGroups.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Nothing waiting. Fixes the check was unsure about land here.</p>
          ) : (
            <ul>
              {suggestionGroups.map((g) => (
                <FixRow key={g.key} group={g} busy={busy} disabled={!!job} onDecide={decide} kind="suggestion" />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Fixed by the check */}
      {status?.migrated && (
        <section className="rounded-xl border border-[var(--border)] mb-5" style={{ background: "var(--surface)" }}>
          <header className="px-5 py-3.5 border-b border-[var(--border)]">
            <div className="flex items-center gap-1">
              <h2 className="text-sm text-[var(--foreground)]">Fixed by the check</h2>
              <HelpButton help={fixedHelp} label="How Undo works" />
            </div>
            <p className="text-[11px] text-[var(--foreground-muted)] mt-1">The latest {status.applied.length} fixes.</p>
            {fixedHelp.open && (
              <div className="mt-2">
                <HelpPanel help={fixedHelp}>
                  <p>Undo puts the old value back if nobody edited the product since; an undone fix is never made again.</p>
                </HelpPanel>
              </div>
            )}
          </header>
          {appliedGroups.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">No fixes yet.</p>
          ) : (
            <ul>
              {appliedGroups.map((g) => (
                <FixRow key={g.key} group={g} busy={busy} disabled={!!job} onDecide={decide} kind="applied" />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Runs */}
      {status?.migrated && status.runs.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm text-[var(--foreground)] mb-3">Runs</h2>
          <div className="rounded-xl border border-[var(--border)] overflow-x-auto" style={{ background: "var(--surface)" }}>
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]" style={{ background: "var(--background)" }}>
                  {["Started", "Kind", "Model", "Products", "Fixed", "For you", "Cost", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status.runs.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3 text-[var(--foreground)] whitespace-nowrap">{when(r.startedAt)}</td>
                    <td className="px-4 py-3 text-[var(--foreground-muted)]">
                      {r.trigger === "auto" ? "After imports" : r.trigger === "brands" ? "Brands" : "Manual"}
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground-muted)]">{r.model}</td>
                    <td className="px-4 py-3 text-[var(--foreground)]">{r.products}</td>
                    <td className="px-4 py-3 text-[var(--foreground)]">{r.applied}</td>
                    <td className="px-4 py-3 text-[var(--foreground)]">{r.suggested}</td>
                    <td className="px-4 py-3 text-[var(--foreground)]">{usd(r.costUsd)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.applied > 0 && (
                        <button
                          onClick={() => undoRun(r)}
                          disabled={busy !== null || !!job}
                          className={btn("ghost", "sm")}
                        >
                          {busy === `run:${r.id}` ? "…" : "Undo run"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
  const f = group.fixes[0];
  const ids = group.fixes.map((x) => x.id);
  const many = group.fixes.length > 1;
  const isBusy = busy === group.key;
  return (
    <li className="px-5 py-3 border-b border-[var(--border)] last:border-b-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 hover:bg-[var(--background)] transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {many ? (
            <span className="text-sm text-[var(--foreground)]">
              {group.fixes.length} products by “{f.beforeText}”
            </span>
          ) : (
            <Link
              href={`/goo-studio/products?search=${encodeURIComponent(f.productName)}`}
              className="text-sm text-[var(--foreground)] hover:underline"
            >
              {f.productName || "(no name)"}
            </Link>
          )}
          {f.confidence === "high" && kind === "suggestion" && (
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--foreground-muted)]">
              Sure
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--foreground-muted)] mt-1 break-words">
          <span className="font-medium">{FIELD_LABEL[f.field] ?? f.field}</span>{" "}
          <span className="font-mono">{f.beforeText || "(none)"}</span>
          {f.writable && (
            <>
              {" "}→ <span className="font-mono text-[var(--foreground)]">{f.afterText || "(none)"}</span>
            </>
          )}
        </p>
        {f.reason && <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5 leading-relaxed">{f.reason}</p>}
      </div>
      <div className="shrink-0 pt-0.5 flex items-center gap-3">
        {kind === "suggestion" ? (
          <>
            {f.writable ? (
              <button
                onClick={() => onDecide(group.key, ids, "apply")}
                disabled={isBusy || disabled}
                className={btn("secondary", "sm")}
              >
                {isBusy ? "…" : many ? `Apply ${ids.length}` : "Apply"}
              </button>
            ) : (
              <Link
                href={`/goo-studio/products?search=${encodeURIComponent(many ? f.beforeText : f.productName)}`}
                className={btn("ghost", "sm")}
              >
                Edit by hand
              </Link>
            )}
            <button
              onClick={() => onDecide(group.key, ids, "dismiss")}
              disabled={isBusy || disabled}
              title="This is wrong — never propose it again"
              className={btn("ghost", "sm")}
            >
              Dismiss
            </button>
          </>
        ) : (
          <button
            onClick={() => onDecide(group.key, ids, "undo")}
            disabled={isBusy || disabled}
            title="Put the old value back"
            className={btn("ghost", "sm")}
          >
            {isBusy ? "…" : many ? `Undo ${ids.length}` : "Undo"}
          </button>
        )}
      </div>
    </li>
  );
}
