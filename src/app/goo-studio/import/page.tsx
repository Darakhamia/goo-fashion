"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  buildImportGroups,
  canRefreshOnly,
  groupUrls,
  mapCSVRow,
  parseCSV,
  summarizeMerchants,
  IMPORT_BATCH_GROUPS,
  MAX_CHECK_URLS,
  type CSVImportGroup,
  type CSVMappedRow,
  type MerchantSummary,
} from "@/lib/csv-import";
import type { Category } from "@/lib/types";

const CATEGORIES: Category[] = [
  "outerwear","blazers","tops","shirts","knitwear","bottoms","jeans",
  "shorts","skirts","dresses","jumpsuits","swimwear","footwear","bags","accessories",
];

type Step = "upload" | "merchants" | "preview";
type Phase = "idle" | "importing" | "done" | "stopped";
type ImportTotals = {
  created: number;
  updated: number;
  merged: number;
  skipped: number;
  errors: { name: string; error: string }[];
  /** Saved, but with columns the database lacks (a migration not run) — each said once. */
  warnings: string[];
};

const EMPTY_TOTALS: ImportTotals = { created: 0, updated: 0, merged: 0, skipped: 0, errors: [], warnings: [] };

/** "Which of these do we carry" requests in flight at once. */
const CHECK_PARALLEL = 3;
/** Failed batches in a row after which the run stops: the server is down, or the session is gone. */
const MAX_FAILED_IN_A_ROW = 3;
const PREVIEW_LIMIT = 200;

/** A row the import can use: a new product, or a sold-out row that refreshes one we carry. */
const isSelectable = (row: CSVMappedRow) => row._valid || canRefreshOnly(row);

// ── Styled primitives (goo-studio recipes, DESIGN_SYSTEM.md §9) ──────────────

const btnPrimary =
  "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-xs tracking-[0.12em] uppercase hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed";
const btnOutline =
  "inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnText =
  "text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40";
const thCls =
  "text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal whitespace-nowrap";
const chipCls = "inline-block text-[10px] tracking-[0.12em] uppercase px-2 py-0.5 rounded-full whitespace-nowrap";
const statusOk = "bg-emerald-400/15 text-emerald-500 border border-emerald-400/30";
const statusWarn = "bg-amber-400/15 text-amber-500 border border-amber-400/30";
const statusError = "bg-red-400/15 text-red-500 border border-red-400/30";
const statusNeutral = "bg-[var(--fg-overlay-05)] text-[var(--foreground-subtle)] border border-[var(--border)]";

const Spinner = () => (
  <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
);

export default function CSVImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // All rows from CSV (kept in memory)
  const [allRows, setAllRows] = useState<CSVMappedRow[]>([]);
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [selectedMerchants, setSelectedMerchants] = useState<Set<string>>(new Set<string>());

  // Preview state
  const [previewRows, setPreviewRows] = useState<CSVMappedRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set<number>());
  const [showAll, setShowAll] = useState(false);

  // Which of the feed's links the catalogue already has — what tells a new
  // product from an update before anything is written.
  const [existing, setExisting] = useState<Set<string> | null>(null);
  const [checking, setChecking] = useState<{ done: number; total: number } | null>(null);
  const [checkError, setCheckError] = useState("");
  const checkRun = useRef(0);

  // Import run
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [totals, setTotals] = useState<ImportTotals>(EMPTY_TOTALS);
  const [failedBatches, setFailedBatches] = useState<string[]>([]);
  const [importError, setImportError] = useState("");
  const stopRef = useRef(false);
  const importing = phase === "importing";

  // ── Step 1: Read the file (in the browser — a feed is too big to upload) ───
  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError("");
    setParsing(true);
    try {
      const text = /\.gz$/i.test(file.name)
        ? await new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text()
        : await file.text();
      if (!text.trim()) { setParseError("CSV file is empty"); return; }

      const { headers, rows } = parseCSV(text);
      if (!headers.length) { setParseError("Could not parse CSV headers"); return; }
      if (!rows.length) { setParseError("The file has a header row but no products"); return; }

      const mapped = rows.map(mapCSVRow);
      setAllRows(mapped);
      setMerchants(summarizeMerchants(mapped));
      setSelectedMerchants(new Set<string>());
      setStep("merchants");
    } catch (e) {
      setParseError(e instanceof Error ? `Failed to read the file: ${e.message}` : "Failed to read the file");
    } finally {
      setParsing(false);
    }
  };

  // ── Which rows' links are already products ─────────────────────────────────
  const checkCatalogue = async (rows: CSVMappedRow[]) => {
    const run = ++checkRun.current;
    setExisting(null);
    setCheckError("");
    const urls = [...new Set(rows.filter(isSelectable).map((r) => r.referralUrl))];
    if (!urls.length) { setExisting(new Set<string>()); setChecking(null); return; }

    const chunks: string[][] = [];
    for (let i = 0; i < urls.length; i += MAX_CHECK_URLS) chunks.push(urls.slice(i, i + MAX_CHECK_URLS));
    setChecking({ done: 0, total: urls.length });

    const found = new Set<string>();
    let done = 0;
    try {
      for (let i = 0; i < chunks.length; i += CHECK_PARALLEL) {
        const answers = await Promise.all(
          chunks.slice(i, i + CHECK_PARALLEL).map(async (chunk) => {
            const res = await fetch("/api/admin/csv-import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ urls: chunk }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !Array.isArray(data?.existing)) {
              throw new Error(data?.error ?? `HTTP ${res.status}`);
            }
            return { count: chunk.length, existing: data.existing as string[] };
          }),
        );
        if (run !== checkRun.current) return;
        for (const answer of answers) {
          for (const url of answer.existing) found.add(url);
          done += answer.count;
        }
        setChecking({ done, total: urls.length });
      }
      setExisting(found);
    } catch (e) {
      if (run !== checkRun.current) return;
      setCheckError(e instanceof Error ? e.message : "unknown error");
    } finally {
      if (run === checkRun.current) setChecking(null);
    }
  };

  // ── Step 2 → 3: Apply merchant filter ──────────────────────────────────────
  const applyMerchantFilter = () => {
    const filtered = allRows.filter((r) => selectedMerchants.has(r.merchant || "Unknown"));
    setPreviewRows(filtered);
    setSelected(new Set<number>(filtered.flatMap((r, i) => (isSelectable(r) ? [i] : []))));
    setShowAll(false);
    setStep("preview");
    void checkCatalogue(filtered);
  };

  const backToMerchants = () => {
    checkRun.current++;
    setChecking(null);
    setStep("merchants");
  };

  // ── What the selection makes: products, and which of them are new ──────────
  const plan = useMemo(() => {
    const groups = buildImportGroups(previewRows.filter((_, i) => selected.has(i)));
    const toSend: CSVImportGroup[] = [];
    let create = 0;
    let update = 0;
    let skip = 0;
    for (const group of groups) {
      const live = group.rows.some((r) => !r.soldOut);
      const known = !!existing && groupUrls(group.rows).some((u) => existing.has(u));
      // Sold out everywhere and not in the catalogue: nothing to create or refresh.
      if (existing && !known && !live) { skip++; continue; }
      toSend.push(group);
      if (known) update++;
      else if (live) create++;
    }
    const multiColour = groups.filter((g) => g.siblingUrls.length > 0).length;
    return { groups: toSend, create, update, skip, multiColour };
  }, [previewRows, selected, existing]);

  // ── Import, a batch at a time ──────────────────────────────────────────────
  const runImport = async () => {
    const groups = plan.groups;
    if (!groups.length) return;
    stopRef.current = false;
    setPhase("importing");
    setImportError("");
    setTotals(EMPTY_TOTALS);
    setFailedBatches([]);
    setProgress({ done: 0, total: groups.length });

    const batches = Math.ceil(groups.length / IMPORT_BATCH_GROUPS);
    let failedInARow = 0;
    for (let b = 0; b < batches; b++) {
      if (stopRef.current) { setPhase("stopped"); return; }
      const slice = groups.slice(b * IMPORT_BATCH_GROUPS, (b + 1) * IMPORT_BATCH_GROUPS);

      let failure = "";
      try {
        const res = await fetch("/api/admin/csv-import", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groups: slice }),
        });
        // A timed-out function answers with the host's error page, not JSON.
        const data = await res.json().catch(() => null);
        if (res.ok && data && typeof data.created === "number") {
          setTotals((t) => ({
            created: t.created + (data.created ?? 0),
            updated: t.updated + (data.updated ?? 0),
            merged: t.merged + (data.merged ?? 0),
            skipped: t.skipped + (data.skipped ?? 0),
            errors: [...t.errors, ...(Array.isArray(data.errors) ? data.errors : [])],
            warnings:
              typeof data.warning === "string" && !t.warnings.includes(data.warning)
                ? [...t.warnings, data.warning]
                : t.warnings,
          }));
        } else {
          failure = data?.error
            ?? (res.status === 504 ? "the server timed out" : `the server answered HTTP ${res.status}`);
        }
      } catch (e) {
        failure = e instanceof Error ? `network error (${e.message})` : "network error";
      }

      if (failure) {
        failedInARow++;
        setFailedBatches((prev) => [
          ...prev,
          `Batch ${b + 1} of ${batches} (${slice.length} products, from “${slice[0].name}”): ${failure}`,
        ]);
      } else {
        failedInARow = 0;
      }
      setProgress({ done: Math.min(groups.length, (b + 1) * IMPORT_BATCH_GROUPS), total: groups.length });

      if (failedInARow >= MAX_FAILED_IN_A_ROW) {
        setImportError(`Stopped after ${MAX_FAILED_IN_A_ROW} failed batches in a row.`);
        setPhase("stopped");
        return;
      }
    }
    // Every batch was sent: a Stop pressed during the last one stopped nothing.
    setPhase("done");
  };

  const reset = () => {
    checkRun.current++;
    setStep("upload");
    setFileName("");
    setAllRows([]);
    setMerchants([]);
    setSelectedMerchants(new Set<string>());
    setPreviewRows([]);
    setSelected(new Set<number>());
    setExisting(null);
    setChecking(null);
    setCheckError("");
    setPhase("idle");
    setTotals(EMPTY_TOTALS);
    setFailedBatches([]);
    setImportError("");
    setParseError("");
  };

  const toggleRow = (i: number) =>
    setSelected((prev: Set<number>) => {
      const next = new Set<number>(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const toggleMerchant = (name: string) =>
    setSelectedMerchants((prev: Set<string>) => {
      const next = new Set<string>(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const validCount = previewRows.filter((r) => r._valid).length;
  const soldOutCount = previewRows.filter(canRefreshOnly).length;
  const unusableCount = previewRows.length - validCount - soldOutCount;
  const displayRows = showAll ? previewRows : previewRows.slice(0, PREVIEW_LIMIT);

  // ── Selected merchants stats ────────────────────────────────────────────────
  const selMerchantStats = merchants.filter((m) => selectedMerchants.has(m.name));
  const selTotal = selMerchantStats.reduce((s, m) => s + m.count, 0);
  const selValid = selMerchantStats.reduce((s, m) => s + m.validCount, 0);

  const finished = phase === "done" || phase === "stopped";
  const partial = phase === "stopped" || failedBatches.length > 0;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">
          Admin / Import
        </p>
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">CSV Import</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Upload an affiliate product feed (Awin, etc.) to bulk-import products. The file is read in your browser;
          products are sent to the catalogue in batches.
        </p>
      </div>

      {/* Step indicators */}
      {step !== "upload" && (
        <div className="flex items-center gap-2 flex-wrap text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)]">
          <span className={step === "merchants" ? "text-[var(--foreground)]" : ""}>1. Merchants</span>
          <span className="text-[var(--border-strong)]">→</span>
          <span className={step === "preview" && !finished ? "text-[var(--foreground)]" : ""}>2. Preview</span>
          <span className="text-[var(--border-strong)]">→</span>
          <span className={phase === "done" ? "text-emerald-500" : importing || phase === "stopped" ? "text-[var(--foreground)]" : ""}>
            3. Import
          </span>
          <button onClick={reset} disabled={importing} className={`ml-4 ${btnText}`}>
            ← Start over
          </button>
        </div>
      )}

      {/* ── STEP 1: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a CSV file"
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !parsing) handleFile(f); }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !parsing && fileRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !parsing) { e.preventDefault(); fileRef.current?.click(); }
            }}
            className="rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--border-strong)] focus-visible:border-[var(--foreground)] outline-none bg-[var(--background)] transition-colors cursor-pointer flex flex-col items-center justify-center py-16 px-4 gap-3 text-center"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-[var(--foreground-muted)]">
              <path d="M16 4V20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M10 10L16 4L22 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 22V26H26V22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {fileName ? (
              <p className="text-sm text-[var(--foreground)] break-all">{fileName}</p>
            ) : (
              <>
                <p className="text-sm text-[var(--foreground-muted)]">Drop CSV file here or click to browse</p>
                <p className="text-[10px] text-[var(--foreground-subtle)] tracking-[0.14em] uppercase">.csv or .csv.gz files</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.gz,text/csv,application/gzip"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </div>
          {parsing && (
            <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
              <Spinner />
              Reading CSV…
            </div>
          )}
          {parseError && (
            <div className={`rounded-lg px-4 py-3 text-[12px] ${statusError}`}>{parseError}</div>
          )}

          {/* Supported columns reference */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-[10px] text-[var(--foreground-muted)] space-y-2">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">Supported Awin feed columns</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5 font-mono mt-1">
              <span><span className="text-[var(--foreground)]">aw_deep_link</span> → affiliate link <span className="text-red-500">*required*</span></span>
              <span><span className="text-[var(--foreground)]">product_name</span> → name</span>
              <span><span className="text-[var(--foreground)]">search_price</span> / display_price → price</span>
              <span><span className="text-[var(--foreground)]">display_price</span> → currency symbol (£€$…)</span>
              <span><span className="text-[var(--foreground)]">currency</span> → ISO currency code (converted to USD)</span>
              <span><span className="text-[var(--foreground)]">rrp_price</span> → original price (for discount)</span>
              <span><span className="text-[var(--foreground)]">aw_image_url</span> → primary image (Awin proxy)</span>
              <span><span className="text-[var(--foreground)]">alternate_image</span> → additional images</span>
              <span><span className="text-[var(--foreground)]">category_name</span> → category + gender</span>
              <span><span className="text-[var(--foreground)]">fashion_suitable_for</span> → gender override</span>
              <span><span className="text-[var(--foreground)]">fashion_size</span> → available sizes</span>
              <span><span className="text-[var(--foreground)]">colour</span> → color (else the name&apos;s “- Blue”)</span>
              <span><span className="text-[var(--foreground)]">description</span> → product description</span>
              <span><span className="text-[var(--foreground)]">specifications</span> → material / fabric</span>
              <span><span className="text-[var(--foreground)]">brand_name</span> → brand</span>
              <span><span className="text-[var(--foreground)]">merchant_name</span> → store</span>
              <span><span className="text-[var(--foreground)]">in_stock</span> → sold out rows only update stock</span>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Merchant selector ── */}
      {step === "merchants" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-[var(--foreground)]">
                {allRows.length.toLocaleString()} rows · {merchants.length} merchant{merchants.length !== 1 ? "s" : ""} detected
              </p>
              <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">
                Select the merchants you want to import from.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setSelectedMerchants(new Set<string>(merchants.map((m) => m.name)))}
                className={btnText}
              >
                Select all
              </button>
              <button onClick={() => setSelectedMerchants(new Set<string>())} className={btnText}>
                Clear
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
            {merchants.map((m) => {
              const isSelected = selectedMerchants.has(m.name);
              const share = allRows.length ? Math.round((m.count / allRows.length) * 100) : 0;
              return (
                <label
                  key={m.name}
                  className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors border-b border-[var(--border)] last:border-0 ${
                    isSelected ? "bg-[var(--surface)]" : "hover:bg-[var(--fg-overlay-05)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMerchant(m.name)}
                    className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--foreground)] truncate">{m.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-[var(--foreground)] tabular-nums">{m.count.toLocaleString()} items</p>
                    <p className="text-[10px] text-emerald-500 tabular-nums">{m.validCount.toLocaleString()} valid</p>
                  </div>
                  <div className="w-24 flex-shrink-0 hidden sm:block">
                    <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
                      <div className="h-full bg-[var(--foreground-muted)]" style={{ width: `${share}%` }} />
                    </div>
                    <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5 text-right tabular-nums">{share}%</p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Footer CTA */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <div>
              {selectedMerchants.size > 0 ? (
                <p className="text-sm text-[var(--foreground)]">
                  <span className="font-medium">{selValid.toLocaleString()}</span> valid products from{" "}
                  <span className="font-medium">{selTotal.toLocaleString()}</span> rows
                  {selTotal - selValid > 0 && (
                    <span className="text-[var(--foreground-muted)] ml-1">
                      ({(selTotal - selValid).toLocaleString()} out of stock / invalid)
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-[var(--foreground-muted)]">Select at least one merchant</p>
              )}
            </div>
            <button onClick={applyMerchantFilter} disabled={!selectedMerchants.size} className={btnPrimary}>
              Preview {selValid > 0 ? `${selValid.toLocaleString()} products →` : "→"}
            </button>
          </div>
        </div>
      )}

      {/* ── Import progress and result ── */}
      {phase !== "idle" && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
          <div className="px-5 py-3.5 space-y-2.5">
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)] tabular-nums">
                {importing && `Importing ${progress.done.toLocaleString()}/${progress.total.toLocaleString()}`}
                {phase === "done" && "Finished"}
                {phase === "stopped" && "Stopped"}
              </p>
              <div className="ml-auto flex items-center gap-3 flex-wrap text-[11px] tabular-nums">
                <span className="text-emerald-500">{totals.created.toLocaleString()} new</span>
                <span className="text-[var(--foreground-muted)]">{totals.updated.toLocaleString()} updated</span>
                {totals.merged > 0 && (
                  <span className="text-[var(--foreground-muted)]" title="Joined a product we already carry from another store">
                    {totals.merged.toLocaleString()} joined existing
                  </span>
                )}
                {totals.skipped > 0 && (
                  <span className="text-[var(--foreground-subtle)]">{totals.skipped.toLocaleString()} skipped</span>
                )}
                {totals.errors.length > 0 && (
                  <span className="text-red-500">{totals.errors.length.toLocaleString()} failed</span>
                )}
                {importing && (
                  <button onClick={() => { stopRef.current = true; }} className={btnOutline}>Stop</button>
                )}
              </div>
            </div>
            <div className="h-1 rounded-full bg-[var(--fg-overlay-08)] overflow-hidden">
              <div
                className="h-full bg-[var(--foreground)] transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            {totals.warnings.map((w) => (
              <p key={w} className={`rounded-lg px-4 py-3 text-[12px] ${statusWarn}`}>{w}</p>
            ))}
          </div>

          {(partial || totals.errors.length > 0 || finished) && (
            <div className="px-5 py-4 border-t border-[var(--border)] space-y-3">
              {partial && (
                <div className={`rounded-lg px-4 py-3 text-[12px] space-y-1.5 ${failedBatches.length ? statusError : statusWarn}`}>
                  {importError && <p>{importError}</p>}
                  {phase === "stopped" && !importError && <p>Stopped before the last batch.</p>}
                  {failedBatches.length > 0 && (
                    <ul className="font-mono text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                      {failedBatches.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                  <p className="text-[var(--foreground-muted)]">
                    The import may have gone through partially: a batch that failed can have written some of its
                    products first. Running the same file again is safe — products already imported are updated,
                    not duplicated.
                  </p>
                </div>
              )}

              {totals.errors.length > 0 && (
                <ul className="text-[11px] text-red-500 font-mono space-y-0.5 max-h-40 overflow-y-auto">
                  {totals.errors.map((e, i) => <li key={i}>{e.name}: {e.error}</li>)}
                </ul>
              )}

              {finished && (
                <div className="flex gap-3 flex-wrap">
                  <Link href="/goo-studio/products" className={btnPrimary}>
                    View products
                  </Link>
                  {partial && (
                    <button onClick={runImport} className={btnOutline}>
                      Run again
                    </button>
                  )}
                  <button onClick={reset} className={btnOutline}>
                    Import another file
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Preview table ── */}
      {step === "preview" && !finished && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-xs text-[var(--foreground-muted)] tabular-nums">
                {previewRows.length.toLocaleString()} rows ·{" "}
                <span className="text-emerald-500">{validCount.toLocaleString()} valid</span>
                {soldOutCount > 0 && (
                  <> · <span className="text-amber-500">{soldOutCount.toLocaleString()} sold out</span></>
                )}
                {unusableCount > 0 && (
                  <> · <span className="text-[var(--foreground-subtle)]">{unusableCount.toLocaleString()} skipped</span></>
                )}
                {" · "}{selected.size.toLocaleString()} selected
              </span>
              <button
                onClick={() => setSelected(new Set<number>(previewRows.flatMap((r, i) => (isSelectable(r) ? [i] : []))))}
                disabled={importing}
                className={btnText}
              >
                Select all
              </button>
              {selected.size > 0 && (
                <button onClick={() => setSelected(new Set<number>())} disabled={importing} className={btnText}>
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={backToMerchants} disabled={importing} className={btnOutline}>
                ← Merchants
              </button>
              {selected.size > 0 && (
                <button
                  onClick={runImport}
                  disabled={importing || !!checking || !plan.groups.length}
                  className={btnPrimary}
                >
                  {importing ? (
                    <><Spinner /> Importing…</>
                  ) : (
                    `Import ${plan.groups.length.toLocaleString()} product${plan.groups.length !== 1 ? "s" : ""}`
                  )}
                </button>
              )}
            </div>
          </div>

          {/* What the import will do */}
          {selected.size > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 space-y-1.5">
              {checking ? (
                <p className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] tabular-nums">
                  <Spinner /> Checking the catalogue… {checking.done.toLocaleString()}/{checking.total.toLocaleString()} links
                </p>
              ) : existing ? (
                <p className="text-xs text-[var(--foreground)] tabular-nums">
                  <span className="text-emerald-500">{plan.create.toLocaleString()} will be created</span>
                  {" · "}
                  <span>{plan.update.toLocaleString()} will be updated</span>
                  {plan.skip > 0 && (
                    <span className="text-[var(--foreground-subtle)]">
                      {" · "}{plan.skip.toLocaleString()} sold out and not in the catalogue — skipped
                    </span>
                  )}
                  {plan.multiColour > 0 && (
                    <span className="text-[var(--foreground-muted)]"> · {plan.multiColour.toLocaleString()} in multi-colour sets</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-[var(--foreground)] tabular-nums">
                  {plan.groups.length.toLocaleString()} products
                  {plan.multiColour > 0 && (
                    <span className="text-[var(--foreground-muted)]"> · {plan.multiColour.toLocaleString()} in multi-colour sets</span>
                  )}
                </p>
              )}
              <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed">
                A product already in the catalogue only gets its price, stock, sizes and stores refreshed — its name,
                category, description, style tags and photos stay as edited. Prices are converted to USD.
              </p>
            </div>
          )}

          {checkError && (
            <div className={`rounded-lg px-4 py-3 text-[12px] space-y-2 ${statusWarn}`}>
              <p>
                Could not check which products are already in the catalogue: {checkError}. The import still updates
                what it finds, but the new / updated split is unknown.
              </p>
              <button onClick={() => void checkCatalogue(previewRows)} disabled={importing} className={btnOutline}>
                Check again
              </button>
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="w-10 px-3 py-3"><span className="sr-only">Select</span></th>
                  <th className={thCls}>Image</th>
                  <th className={thCls}>Name</th>
                  <th className={thCls}>Brand</th>
                  <th className={thCls}>Category</th>
                  <th className={thCls}>Gender</th>
                  <th className={thCls}>Price</th>
                  <th className={thCls}>Sizes</th>
                  <th className={thCls}>Link</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => {
                  const isSelected = selected.has(i);
                  const selectable = isSelectable(row);
                  const soldOut = !row._valid && selectable;
                  return (
                    <tr
                      key={i}
                      onClick={() => selectable && !importing && toggleRow(i)}
                      className={`border-b border-[var(--border)] last:border-0 transition-colors ${
                        selectable ? "cursor-pointer" : "opacity-40 cursor-default"
                      } ${isSelected ? "bg-[var(--surface)]" : "hover:bg-[var(--fg-overlay-05)]"}`}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!selectable || importing}
                          onChange={() => toggleRow(i)}
                          aria-label={`Select ${row.name || "row"}`}
                          className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer disabled:cursor-default"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="relative w-10 h-14">
                          {row.imageUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={row.imageUrl} alt="" loading="lazy" className="w-10 h-14 object-cover rounded-lg bg-[var(--surface)]" />
                            : <div className="w-10 h-14 rounded-lg bg-[var(--surface)]" />}
                          {row.images && row.images.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 text-[10px] leading-none bg-[var(--foreground)] text-[var(--background)] px-1 py-0.5 rounded-full tabular-nums">
                              +{row.images.length - 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 max-w-[220px]">
                        <p className="text-[var(--foreground)] leading-snug line-clamp-2">{row.name || "—"}</p>
                      </td>
                      <td className="px-4 py-2 text-[var(--foreground-muted)] whitespace-nowrap">{row.brand || "—"}</td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={row.category}
                          disabled={importing}
                          aria-label="Category"
                          onChange={(e) => {
                            const category = e.target.value as Category;
                            setPreviewRows((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], category };
                              return next;
                            });
                          }}
                          className="text-[10px] bg-transparent rounded-lg border border-transparent focus:border-[var(--foreground)] outline-none px-1 py-0.5 text-[var(--foreground-muted)] cursor-pointer"
                        >
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-[var(--foreground-muted)] whitespace-nowrap text-[10px]">
                        {row.gender ?? "—"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap font-mono text-[10px]">
                        {row.price > 0 ? (
                          <span className="text-[var(--foreground)]">
                            {row.price} <span className="text-[var(--foreground-muted)]">{row.currency}</span>
                          </span>
                        ) : "—"}
                        {row.priceOriginal > row.price && (
                          <span className="ml-1 text-[var(--foreground-subtle)] line-through">
                            {row.priceOriginal}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[var(--foreground-muted)] text-[10px] max-w-[100px]">
                        {row.sizes?.length
                          ? <span className="truncate block">{row.sizes.slice(0, 4).join(", ")}{row.sizes.length > 4 ? "…" : ""}</span>
                          : <span className="text-[var(--foreground-subtle)]">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        {/^https?:\/\//.test(row.referralUrl)
                          ? <span className="text-[10px] text-emerald-500">✓ link</span>
                          : <span className="text-[10px] text-red-500">no link</span>}
                      </td>
                      <td className="px-4 py-2">
                        {row._valid ? (
                          <span className={`${chipCls} ${statusOk}`}>OK</span>
                        ) : soldOut ? (
                          <span
                            className={`${chipCls} ${statusWarn} cursor-help`}
                            title="Sold out: updates the stock of a product already in the catalogue, never creates one"
                          >
                            Sold out
                          </span>
                        ) : (
                          <span className={`${chipCls} ${statusNeutral} cursor-help`} title={row._issues.join("; ")}>
                            {row._issues[0] ?? "skip"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {previewRows.length > PREVIEW_LIMIT && !showAll && (
            <div className="text-center py-2">
              <button onClick={() => setShowAll(true)} className={btnText}>
                Showing first {PREVIEW_LIMIT} rows — show all {previewRows.length.toLocaleString()} →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
