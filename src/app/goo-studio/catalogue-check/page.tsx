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

const outline =
  "px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const primary =
  "bg-[var(--foreground)] text-[var(--surface)] px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed";
const small = "text-[10px] tracking-[0.1em] uppercase transition-colors disabled:opacity-40";
const inputClass =
  "w-full rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";
const labelClass = "block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5";

// Below a dime every figure gets three decimals, so a column of run costs
// reads $0.010 / $0.005 instead of mixing $0.01 with $0.0052.
function usd(n: number): string {
  if (!n) return "$0";
  return n < 0.1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const stopRef = useRef(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => setToast({ msg, type });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

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
      showToast("Settings saved");
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save.", "err");
    } finally {
      setSaving(false);
    }
  };

  /** Walk the catalogue a step at a time until it is done or Stop is pressed. */
  const run = async (which: Job) => {
    if (which === "all" && status) {
      const ok = confirm(
        `Re-check all ${status.counts.products} products? Estimated cost about ${usd(status.estimate.allUsd)}. Fixes you undid or dismissed are not made again.`,
      );
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
      showToast(stopRef.current ? "Stopped" : "Done");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "The run stopped.", "err");
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
      showToast(msg, json.stale || json.errors?.length ? "err" : "ok");
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save.", "err");
    } finally {
      setBusy(null);
    }
  };

  const undoRun = async (r: Run) => {
    if (!confirm(`Undo the ${r.applied} fix${r.applied === 1 ? "" : "es"} this run made? Products edited since are left as they are.`)) return;
    setBusy(`run:${r.id}`);
    try {
      const json = await post({ action: "undo_run", runId: r.id });
      showToast(json.stale ? `Undone ${json.done}; ${json.stale} changed since — left as they are` : `Undone ${json.done}`);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not undo.", "err");
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
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">AI check</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
            {status
              ? `${checked} of ${status.counts.products} products checked · ${status.counts.suggestions} waiting for you · ${usd(status.spend.totalThisMonth)} spent this month`
              : "Loading…"}
          </p>
        </div>
        <button onClick={() => load()} disabled={loading || !!job} className={outline}>
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
          <h2 className="text-sm text-[var(--foreground)]">Check the catalogue</h2>
          <p className="text-[11px] text-[var(--foreground-muted)] mt-1 leading-relaxed">
            New products are checked by themselves after every import. Here you run it over everything at once. A product is only
            sent to the model again when it has changed since its last check.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => run("unchecked")} disabled={!ready || !!job || !status?.counts.unchecked} className={primary}>
              Check unchecked ({status?.counts.unchecked ?? 0}) · ~{usd(status?.estimate.uncheckedUsd ?? 0)}
            </button>
            <button onClick={() => run("brands")} disabled={!ready || !!job} className={outline} title="Find one brand spelled several ways and unify it">
              Unify brand spellings
            </button>
            <button onClick={() => run("changed")} disabled={!ready || !!job} className={outline} title="Products edited or re-collected since their last check">
              Re-check changed
            </button>
            <button onClick={() => run("all")} disabled={!ready || !!job} className={outline}>
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
                    className={`${small} text-[var(--foreground-muted)] hover:text-[var(--foreground)]`}
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
                      className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border rounded-full transition-colors ${
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
                    className={`${inputClass} bg-[var(--surface)]`}
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
                <button onClick={saveSettings} disabled={saving || !settingsChanged} className={primary}>
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
            <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">{status.counts.suggestions}</span>
            {writableSuggestions.length > 1 && (
              <button
                onClick={() => {
                  if (confirm(`Apply all ${writableSuggestions.length} shown? Each is checked against the product first.`)) {
                    void decide("all", writableSuggestions, "apply");
                  }
                }}
                disabled={busy !== null || !!job}
                className={`ml-auto ${primary} px-3 py-1.5 text-[10px]`}
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
            <h2 className="text-sm text-[var(--foreground)]">Fixed by the check</h2>
            <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
              The latest {status.applied.length} fixes. Undo puts the old value back if nobody edited the product since; an undone fix
              is never made again.
            </p>
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
                    <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
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
                          className={`${small} text-[var(--foreground-subtle)] hover:text-[var(--foreground)]`}
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

      <p className="mt-6 text-[11px] text-[var(--foreground-muted)] leading-relaxed max-w-3xl">
        The model sees each product record as it is stored — name, brand, category, gender, colours, material, sizes, description,
        price and store links — next to the catalogue&apos;s brand spellings and category tree. It cannot write to the database: it
        answers, and the server writes only what the record itself backs. A brand must be named in the record or already be one of
        ours; a colour or a material must be named in its text; a name, description or size list can only lose words. Prices are
        never changed, only flagged.
      </p>

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
            <span className="text-[10px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--foreground-muted)]">
              sure
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--foreground-muted)] mt-1 break-words">
          <span className="uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">{FIELD_LABEL[f.field] ?? f.field}</span>{" "}
          <span className="font-mono">{f.beforeText || "(none)"}</span>
          {f.writable && (
            <>
              {" "}→ <span className="font-mono text-[var(--foreground)]">{f.afterText || "(none)"}</span>
            </>
          )}
        </p>
        {f.reason && <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5 leading-relaxed">{f.reason}</p>}
      </div>
      <div className="shrink-0 pt-0.5 flex items-center gap-3">
        {kind === "suggestion" ? (
          <>
            {f.writable ? (
              <button
                onClick={() => onDecide(group.key, ids, "apply")}
                disabled={isBusy || disabled}
                className="bg-[var(--foreground)] text-[var(--surface)] px-3 py-1.5 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40"
              >
                {isBusy ? "…" : many ? `Apply ${ids.length}` : "Apply"}
              </button>
            ) : (
              <span className={`${small} text-[var(--foreground-subtle)]`}>Edit by hand</span>
            )}
            <button
              onClick={() => onDecide(group.key, ids, "dismiss")}
              disabled={isBusy || disabled}
              title="This is wrong — never propose it again"
              className={`${small} text-[var(--foreground-subtle)] hover:text-[var(--foreground)]`}
            >
              Dismiss
            </button>
          </>
        ) : (
          <button
            onClick={() => onDecide(group.key, ids, "undo")}
            disabled={isBusy || disabled}
            title="Put the old value back"
            className={`${small} text-[var(--foreground-subtle)] hover:text-[var(--foreground)]`}
          >
            {isBusy ? "…" : many ? `Undo ${ids.length}` : "Undo"}
          </button>
        )}
      </div>
    </li>
  );
}
