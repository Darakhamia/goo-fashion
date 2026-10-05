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
import type { Category, Gender } from "@/lib/types";
import { AdminPage } from "@/components/admin/AdminPage";
import { Badge } from "@/components/admin/Badge";
import { DataTable, Thumb, type Column } from "@/components/admin/DataTable";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { PageHeader } from "@/components/admin/PageHeader";
import { BANNER, btn, PANEL } from "../_ui/recipes";
import { useFormat, useT, type Key } from "../_i18n";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

/*
 * CSV import (docs/ADMIN_DESIGN.md §6, GS4-12): an affiliate feed is read in
 * the browser, narrowed to the merchants picked, previewed row by row with the
 * catalog's answer to "which of these do we carry", and sent in batches.
 */

const CATEGORIES: Category[] = [
  "outerwear","blazers","tops","shirts","knitwear","bottoms","jeans",
  "shorts","skirts","dresses","jumpsuits","swimwear","footwear","bags","accessories",
];

/** The Awin columns the import reads (src/lib/csv-import.ts), and what each becomes. */
const FEED_COLUMNS: { cols: string[]; key: Key; required?: boolean }[] = [
  { cols: ["aw_deep_link"], key: "import.col.link", required: true },
  { cols: ["product_name"], key: "import.col.name" },
  { cols: ["search_price", "display_price"], key: "import.col.price" },
  { cols: ["display_price"], key: "import.col.currencySymbol" },
  { cols: ["currency"], key: "import.col.currency" },
  { cols: ["rrp_price"], key: "import.col.rrp" },
  { cols: ["aw_image_url"], key: "import.col.image" },
  { cols: ["alternate_image"], key: "import.col.images" },
  { cols: ["category_name"], key: "import.col.category" },
  { cols: ["fashion_suitable_for"], key: "import.col.gender" },
  { cols: ["fashion_size"], key: "import.col.sizes" },
  { cols: ["colour"], key: "import.col.color" },
  { cols: ["description"], key: "import.col.description" },
  { cols: ["specifications"], key: "import.col.material" },
  { cols: ["brand_name"], key: "import.col.brand" },
  { cols: ["merchant_name"], key: "import.col.store" },
  { cols: ["in_stock"], key: "import.col.stock" },
];

/** The reasons mapCSVRow gives for a row it cannot use, in the dictionary. */
const ISSUE_KEY: Record<string, Key> = {
  "missing name": "import.issue.missingName",
  "missing price": "import.issue.missingPrice",
  "bad affiliate link": "import.issue.badLink",
  "no affiliate link": "import.issue.noLink",
  "out of stock": "import.issue.outOfStock",
};

const GENDER_KEY: Record<Gender, Key> = {
  women: "import.gender.women",
  men: "import.gender.men",
  unisex: "import.gender.unisex",
};

/** summarizeMerchants files rows without a merchant under this name. */
const UNKNOWN_MERCHANT = "Unknown";

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
/** A preview row with its index in previewRows, which the selection holds. */
type PreviewItem = { row: CSVMappedRow; i: number };

const EMPTY_TOTALS: ImportTotals = { created: 0, updated: 0, merged: 0, skipped: 0, errors: [], warnings: [] };

/** "Which of these do we carry" requests in flight at once. */
const CHECK_PARALLEL = 3;
/** Failed batches in a row after which the run stops: the server is down, or the session is gone. */
const MAX_FAILED_IN_A_ROW = 3;
const PREVIEW_LIMIT = 200;

/** A row the import can use: a new product, or a sold-out row that refreshes one we carry. */
const isSelectable = (row: CSVMappedRow) => row._valid || canRefreshOnly(row);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const Spinner = () => (
  <span aria-hidden="true" className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
);

// Banners (DESIGN_SYSTEM.md §9, "Statuses, banners and toasts").

export default function CSVImportPage() {
  const t = useT();
  const f = useFormat();
  const help = useHelp("import");
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

  // Which of the feed's links the catalog already has — what tells a new
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
      if (!text.trim()) { setParseError(t("import.error.empty")); return; }

      const { headers, rows } = parseCSV(text);
      if (!headers.length) { setParseError(t("import.error.headers")); return; }
      if (!rows.length) { setParseError(t("import.error.noRows")); return; }

      const mapped = rows.map(mapCSVRow);
      setAllRows(mapped);
      setMerchants(summarizeMerchants(mapped));
      setSelectedMerchants(new Set<string>());
      setStep("merchants");
    } catch (e) {
      setParseError(e instanceof Error ? t("import.error.read", { error: e.message }) : t("import.error.readPlain"));
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
      setCheckError(e instanceof Error ? e.message : t("import.plan.unknownError"));
    } finally {
      if (run === checkRun.current) setChecking(null);
    }
  };

  // ── Step 2 → 3: Apply merchant filter ──────────────────────────────────────
  const applyMerchantFilter = () => {
    const filtered = allRows.filter((r) => selectedMerchants.has(r.merchant || UNKNOWN_MERCHANT));
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
      // Sold out everywhere and not in the catalog: nothing to create or refresh.
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
          setTotals((prev) => ({
            created: prev.created + (data.created ?? 0),
            updated: prev.updated + (data.updated ?? 0),
            merged: prev.merged + (data.merged ?? 0),
            skipped: prev.skipped + (data.skipped ?? 0),
            errors: [...prev.errors, ...(Array.isArray(data.errors) ? data.errors : [])],
            warnings:
              typeof data.warning === "string" && !prev.warnings.includes(data.warning)
                ? [...prev.warnings, data.warning]
                : prev.warnings,
          }));
        } else {
          failure = data?.error
            ?? (res.status === 504 ? t("import.run.timeout") : t("import.run.http", { status: String(res.status) }));
        }
      } catch (e) {
        failure = e instanceof Error ? t("import.run.network", { error: e.message }) : t("import.run.networkPlain");
      }

      if (failure) {
        failedInARow++;
        setFailedBatches((prev) => [
          ...prev,
          t("import.run.batchFailed", { n: b + 1, total: batches, count: slice.length, name: slice[0].name, error: failure }),
        ]);
      } else {
        failedInARow = 0;
      }
      setProgress({ done: Math.min(groups.length, (b + 1) * IMPORT_BATCH_GROUPS), total: groups.length });

      if (failedInARow >= MAX_FAILED_IN_A_ROW) {
        setImportError(t("import.run.stoppedAfter", { count: MAX_FAILED_IN_A_ROW }));
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

  const selectAllRows = () =>
    setSelected(new Set<number>(previewRows.flatMap((r, i) => (isSelectable(r) ? [i] : []))));

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
  const selectableCount = validCount + soldOutCount;
  const displayRows = showAll ? previewRows : previewRows.slice(0, PREVIEW_LIMIT);
  // A phone gets the preview as cards: the table is too wide for it (GS4-11).
  const phone = useMediaQuery("(width < 48rem)");
  // The table's selection is keyed by strings: the row's index in previewRows.
  const selectedKeys = useMemo(() => new Set<string>([...selected].map(String)), [selected]);

  // ── Preview row parts, shared by the table and the phone's cards ───────────
  const genderLabel = (row: CSVMappedRow) => (row.gender ? t(GENDER_KEY[row.gender]) : "");
  const issueText = (issue: string) => (ISSUE_KEY[issue] ? t(ISSUE_KEY[issue]) : issue);
  const rowName = (row: CSVMappedRow) => row.name || t("import.preview.unnamed");
  const imageCount = (row: CSVMappedRow) =>
    row.images && row.images.length > 1 && (
      <span className="absolute -bottom-1 -right-1 text-[11px] leading-none bg-[var(--foreground)] text-[var(--surface)] px-1 py-0.5 rounded-full tabular-nums">
        +{row.images.length - 1}
      </span>
    );
  const previewImage = (row: CSVMappedRow) => (
    <div className="relative w-10 h-14 flex-shrink-0">
      {row.imageUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={row.imageUrl} alt="" loading="lazy" className="w-10 h-14 object-cover rounded-lg bg-[var(--background)]" />
        : <div className="w-10 h-14 rounded-lg bg-[var(--background)]" />}
      {imageCount(row)}
    </div>
  );
  const categorySelect = (row: CSVMappedRow, i: number) => (
    <select
      value={row.category}
      disabled={importing}
      aria-label={t("import.th.category")}
      onChange={(e) => {
        const category = e.target.value as Category;
        setPreviewRows((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], category };
          return next;
        });
      }}
      className="text-[12px] bg-transparent rounded-lg border border-transparent focus:border-[var(--foreground)] outline-none px-1 py-0.5 text-[var(--foreground-muted)] cursor-pointer"
    >
      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
  const statusBadge = (row: CSVMappedRow) =>
    row._valid ? (
      <Badge tone="ok">{t("import.status.ok")}</Badge>
    ) : isSelectable(row) ? (
      <Badge tone="warn" title={t("import.status.soldOutHint")}>{t("import.status.soldOut")}</Badge>
    ) : (
      <Badge title={row._issues.map(issueText).join("; ")}>
        {row._issues[0] ? capitalize(issueText(row._issues[0])) : t("import.status.skip")}
      </Badge>
    );
  // A row the import cannot use stays visible, faded.
  const fade = (row: CSVMappedRow) => (isSelectable(row) ? "" : "opacity-40");

  const previewColumns: Column<PreviewItem>[] = [
    {
      key: "product",
      header: t("import.th.product"),
      grow: true,
      cell: ({ row }) => (
        <div className={`flex items-center gap-3 min-w-0 ${fade(row)}`}>
          <span className="relative flex flex-shrink-0">
            <Thumb src={row.imageUrl || null} />
            {imageCount(row)}
          </span>
          <div className="min-w-0">
            <p className="truncate" title={row.name}>{row.name || "—"}</p>
            <p className="text-[12px] text-[var(--foreground-muted)] truncate">{row.brand || "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: t("import.th.category"),
      cell: ({ row, i }) => <div className={fade(row)}>{categorySelect(row, i)}</div>,
    },
    {
      key: "gender",
      header: t("import.th.gender"),
      hide: "lg",
      cell: ({ row }) => <span className={`text-[var(--foreground-muted)] ${fade(row)}`}>{genderLabel(row) || "—"}</span>,
    },
    {
      key: "price",
      header: t("import.th.price"),
      align: "right",
      cell: ({ row }) => (
        <span className={fade(row)}>
          {row.price > 0 ? (
            <>
              {f.number(row.price)} <span className="text-[var(--foreground-muted)]">{row.currency}</span>
            </>
          ) : "—"}
          {row.priceOriginal > row.price && (
            <span className="ml-1 text-[var(--foreground-muted)] line-through">{f.number(row.priceOriginal)}</span>
          )}
        </span>
      ),
    },
    {
      key: "sizes",
      header: t("import.th.sizes"),
      hide: "lg",
      cell: ({ row }) =>
        row.sizes?.length ? (
          <span className={`block max-w-[100px] truncate text-[var(--foreground-muted)] ${fade(row)}`}>
            {row.sizes.slice(0, 4).join(", ")}{row.sizes.length > 4 ? "…" : ""}
          </span>
        ) : (
          <span className={`text-[var(--foreground-subtle)] ${fade(row)}`}>—</span>
        ),
    },
    {
      key: "link",
      header: t("import.th.link"),
      hide: "lg",
      cell: ({ row }) =>
        /^https?:\/\//.test(row.referralUrl)
          ? <span className={`text-[12px] text-[var(--ok)] ${fade(row)}`}>{t("import.link.ok")}</span>
          : <span className={`text-[12px] text-[var(--err)] ${fade(row)}`}>{t("import.link.none")}</span>,
    },
    {
      key: "status",
      header: t("import.th.status"),
      cell: ({ row }) => <div className={fade(row)}>{statusBadge(row)}</div>,
    },
  ];

  // ── Selected merchants stats ────────────────────────────────────────────────
  const selMerchantStats = merchants.filter((m) => selectedMerchants.has(m.name));
  const selTotal = selMerchantStats.reduce((s, m) => s + m.count, 0);
  const selValid = selMerchantStats.reduce((s, m) => s + m.validCount, 0);

  const finished = phase === "done" || phase === "stopped";
  const partial = phase === "stopped" || failedBatches.length > 0;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <AdminPage>
      <PageHeader
        title={t("nav.import")}
        titleExtra={<HelpButton help={help} label={t("import.help.label")} />}
        subtitle={t("import.subtitle")}
        actions={
          step !== "upload"
            ? [{ key: "restart", label: t("import.startOver"), onClick: reset, disabled: importing }]
            : []
        }
      />
      {help.open && (
        <div className="-mt-4 mb-6">
          <HelpPanel help={help}>
            <p>{t("import.help.intro")}</p>
            <p>{t("import.help.existing")}</p>
          </HelpPanel>
        </div>
      )}

      <div className="space-y-6">
        {/* Step indicators */}
        {step !== "upload" && (
          <ol aria-label={t("import.steps")} className="flex items-center gap-2 flex-wrap text-[12px] font-medium text-[var(--foreground-muted)]">
            <li aria-current={step === "merchants" ? "step" : undefined} className={step === "merchants" ? "text-[var(--foreground)]" : ""}>
              {t("import.step.merchants")}
            </li>
            <li aria-hidden="true" className="text-[var(--border-strong)]">→</li>
            <li
              aria-current={step === "preview" && !finished ? "step" : undefined}
              className={step === "preview" && !finished ? "text-[var(--foreground)]" : ""}
            >
              {t("import.step.preview")}
            </li>
            <li aria-hidden="true" className="text-[var(--border-strong)]">→</li>
            <li
              aria-current={importing || finished ? "step" : undefined}
              className={phase === "done" ? "text-[var(--ok)]" : importing || phase === "stopped" ? "text-[var(--foreground)]" : ""}
            >
              {t("import.step.import")}
            </li>
          </ol>
        )}

        {/* ── STEP 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              aria-label={t("import.upload.choose")}
              onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && !parsing) handleFile(file); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => !parsing && fileRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !parsing) { e.preventDefault(); fileRef.current?.click(); }
              }}
              className="rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--border-strong)] focus-visible:border-[var(--foreground)] outline-none bg-[var(--surface)] transition-colors cursor-pointer flex flex-col items-center justify-center py-16 px-4 gap-3 text-center"
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="text-[var(--foreground-muted)]">
                <path d="M16 4V20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M10 10L16 4L22 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 22V26H26V22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {fileName ? (
                <p className="text-sm text-[var(--foreground)] break-all">{fileName}</p>
              ) : (
                <>
                  <p className="text-sm text-[var(--foreground-muted)]">{t("import.upload.drop")}</p>
                  <p className="text-[12px] text-[var(--foreground-muted)]">{t("import.upload.formats")}</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.gz,text/csv,application/gzip"
                className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = ""; }}
              />
            </div>
            {parsing && (
              <div role="status" className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                <Spinner />
                {t("import.upload.reading")}
              </div>
            )}
            {parseError && (
              <div role="alert" className={BANNER.err}>{parseError}</div>
            )}

            {/* Supported columns reference */}
            <div className={`${PANEL} p-4 text-[12px] text-[var(--foreground-muted)] space-y-2`}>
              <h2 className="text-[13px] font-medium text-[var(--foreground)]">{t("import.columns.title")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5 font-mono mt-1">
                {FEED_COLUMNS.map(({ cols, key, required }) => (
                  <span key={key}>
                    {cols.map((col, i) => (
                      <span key={col}>
                        {i > 0 && " / "}
                        <span className="text-[var(--foreground)]">{col}</span>
                      </span>
                    ))}
                    {" → "}{t(key)}
                    {required && <span className="ml-1 text-[var(--err)]">{t("import.columns.required")}</span>}
                  </span>
                ))}
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
                  {t("import.rows", { count: allRows.length })} · {t("import.merchants.detected", { count: merchants.length })}
                </p>
                <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">{t("import.merchants.hint")}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setSelectedMerchants(new Set<string>(merchants.map((m) => m.name)))}
                  className={btn("ghost")}
                >
                  {t("import.selectAll")}
                </button>
                <button onClick={() => setSelectedMerchants(new Set<string>())} className={btn("ghost")}>
                  {t("import.clear")}
                </button>
              </div>
            </div>

            <div className={`${PANEL} overflow-hidden`}>
              {merchants.map((m) => {
                const isSelected = selectedMerchants.has(m.name);
                const share = allRows.length ? Math.round((m.count / allRows.length) * 100) : 0;
                return (
                  <label
                    key={m.name}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors border-b border-[var(--border)] last:border-0 ${
                      isSelected ? "bg-[var(--fg-overlay-05)]" : "hover:bg-[var(--fg-overlay-05)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleMerchant(m.name)}
                      className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--foreground)] truncate">
                        {m.name === UNKNOWN_MERCHANT ? t("import.merchants.unknown") : m.name}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[var(--foreground)] tabular-nums">{t("import.merchants.items", { count: m.count })}</p>
                      <p className="text-[12px] text-[var(--ok)] tabular-nums">{t("import.count.valid", { count: m.validCount })}</p>
                    </div>
                    <div className="w-24 flex-shrink-0 hidden sm:block">
                      <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
                        <div className="h-full bg-[var(--foreground-muted)]" style={{ width: `${share}%` }} />
                      </div>
                      <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5 text-right tabular-nums">{f.number(share)}%</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Footer CTA */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              <div>
                {selectedMerchants.size > 0 ? (
                  <p className="text-sm text-[var(--foreground)] tabular-nums">
                    <span className="font-medium">{t("import.merchants.validProducts", { count: selValid })}</span>
                    {" · "}{t("import.rows", { count: selTotal })}
                    {selTotal - selValid > 0 && (
                      <span className="text-[var(--foreground-muted)]">
                        {" · "}{t("import.merchants.unusable", { count: selTotal - selValid })}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--foreground-muted)]">{t("import.merchants.none")}</p>
                )}
              </div>
              <button onClick={applyMerchantFilter} disabled={!selectedMerchants.size} className={btn("primary")}>
                {selValid > 0 ? t("import.merchants.preview", { count: selValid }) : t("import.merchants.previewNone")}
              </button>
            </div>
          </div>
        )}

        {/* ── Import progress and result ── */}
        {phase !== "idle" && (
          <div className={`${PANEL} overflow-hidden`}>
            <div className="px-5 py-3.5 space-y-2.5">
              <div className="flex items-center gap-4 flex-wrap">
                <p className="text-[13px] font-medium text-[var(--foreground)] tabular-nums">
                  {importing && t("import.run.importing", { done: progress.done, total: progress.total })}
                  {phase === "done" && t("import.run.done")}
                  {phase === "stopped" && t("import.run.stopped")}
                </p>
                <div className="ml-auto flex items-center gap-3 flex-wrap text-[12px] tabular-nums">
                  <span className="text-[var(--ok)]">{t("import.run.created", { count: totals.created })}</span>
                  <span className="text-[var(--foreground-muted)]">{t("import.run.updated", { count: totals.updated })}</span>
                  {totals.merged > 0 && (
                    <span className="text-[var(--foreground-muted)]" title={t("import.run.mergedHint")}>
                      {t("import.run.merged", { count: totals.merged })}
                    </span>
                  )}
                  {totals.skipped > 0 && (
                    <span className="text-[var(--foreground-muted)]">{t("import.run.skipped", { count: totals.skipped })}</span>
                  )}
                  {totals.errors.length > 0 && (
                    <span className="text-[var(--err)]">{t("import.run.failed", { count: totals.errors.length })}</span>
                  )}
                  {importing && (
                    <button onClick={() => { stopRef.current = true; }} className={btn("secondary")}>
                      {t("import.run.stop")}
                    </button>
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
                <p key={w} className={BANNER.warn}>{w}</p>
              ))}
            </div>

            {(partial || totals.errors.length > 0 || finished) && (
              <div className="px-5 py-4 border-t border-[var(--border)] space-y-3">
                {partial && (
                  // A framed note on the panel, not a tinted fill: muted text on the
                  // tint falls short of AA (DESIGN_SYSTEM.md §9).
                  <div
                    className={`rounded-xl border px-4 py-3 text-[12px] space-y-1.5 ${
                      failedBatches.length ? "border-[var(--err-line)] text-[var(--err)]" : "border-[var(--warn-line)] text-[var(--warn)]"
                    }`}
                  >
                    {importError && <p>{importError}</p>}
                    {phase === "stopped" && !importError && <p>{t("import.run.stoppedEarly")}</p>}
                    {failedBatches.length > 0 && (
                      <ul className="font-mono text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                        {failedBatches.map((line, i) => <li key={i}>{line}</li>)}
                      </ul>
                    )}
                    <p className="text-[var(--foreground-muted)]">{t("import.run.partialHint")}</p>
                  </div>
                )}

                {totals.errors.length > 0 && (
                  <ul className="text-[11px] text-[var(--err)] font-mono space-y-0.5 max-h-40 overflow-y-auto">
                    {totals.errors.map((e, i) => <li key={i}>{e.name}: {e.error}</li>)}
                  </ul>
                )}

                {finished && (
                  <div className="flex gap-3 flex-wrap">
                    <Link href="/goo-studio/products" className={btn("primary")}>
                      {t("import.run.viewProducts")}
                    </Link>
                    {partial && (
                      <button onClick={runImport} className={btn("secondary")}>
                        {t("import.run.again")}
                      </button>
                    )}
                    <button onClick={reset} className={btn("secondary")}>
                      {t("import.run.another")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Preview ── */}
        {step === "preview" && !finished && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-[var(--foreground-muted)] tabular-nums">
                  {t("import.rows", { count: previewRows.length })}
                  {" · "}
                  <span className="text-[var(--ok)]">{t("import.count.valid", { count: validCount })}</span>
                  {soldOutCount > 0 && (
                    <>{" · "}<span className="text-[var(--warn)]">{t("import.count.soldOut", { count: soldOutCount })}</span></>
                  )}
                  {unusableCount > 0 && (
                    <>{" · "}{t("import.count.skipped", { count: unusableCount })}</>
                  )}
                  {" · "}{t("import.count.selected", { count: selected.size })}
                </span>
                <button onClick={selectAllRows} disabled={importing} className={btn("ghost")}>
                  {t("import.selectAll")}
                </button>
                {selected.size > 0 && (
                  <button onClick={() => setSelected(new Set<number>())} disabled={importing} className={btn("ghost")}>
                    {t("import.clear")}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={backToMerchants} disabled={importing} className={btn("secondary")}>
                  {t("import.preview.back")}
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={runImport}
                    disabled={importing || !!checking || !plan.groups.length}
                    className={btn("primary")}
                  >
                    {importing ? (
                      <><Spinner /> {t("import.preview.importing")}</>
                    ) : (
                      t("import.preview.import", { count: plan.groups.length })
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* What the import will do */}
            {selected.size > 0 && (
              <div className={`${PANEL} px-4 py-3`}>
                {checking ? (
                  <p className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] tabular-nums">
                    <Spinner /> {t("import.plan.checking", { done: checking.done, total: checking.total })}
                  </p>
                ) : existing ? (
                  <p className="text-xs text-[var(--foreground)] tabular-nums">
                    <span className="text-[var(--ok)]">{t("import.plan.create", { count: plan.create })}</span>
                    {" · "}
                    <span>{t("import.plan.update", { count: plan.update })}</span>
                    {plan.skip > 0 && (
                      <span className="text-[var(--foreground-muted)]">
                        {" · "}{t("import.plan.skip", { count: plan.skip })}
                      </span>
                    )}
                    {plan.multiColour > 0 && (
                      <span className="text-[var(--foreground-muted)]">
                        {" · "}{t("import.plan.multiColor", { count: plan.multiColour })}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--foreground)] tabular-nums">
                    {t("import.plan.products", { count: plan.groups.length })}
                    {plan.multiColour > 0 && (
                      <span className="text-[var(--foreground-muted)]">
                        {" · "}{t("import.plan.multiColor", { count: plan.multiColour })}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}

            {checkError && (
              <div className={`${BANNER.warn} space-y-2`}>
                <p>{t("import.plan.checkFailed", { error: checkError })}</p>
                <button onClick={() => void checkCatalogue(previewRows)} disabled={importing} className={btn("secondary")}>
                  {t("import.plan.checkAgain")}
                </button>
              </div>
            )}

            {phone ? (
              <ul aria-label={t("import.preview.label")} className={`${PANEL} overflow-hidden`}>
                {displayRows.map((row, i) => {
                  const isSelected = selected.has(i);
                  const selectable = isSelectable(row);
                  const price = row.price > 0 ? `${f.number(row.price)} ${row.currency}` : "—";
                  const gender = genderLabel(row);
                  return (
                    <li
                      key={i}
                      // A tap on the card ticks it, as a click on a table row does;
                      // the box and the category keep their own.
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("input, select, label")) return;
                        if (selectable && !importing) toggleRow(i);
                      }}
                      className={`flex items-start gap-3 px-3 py-3 ${i > 0 ? "border-t border-[var(--border)]" : ""} ${
                        selectable ? "cursor-pointer" : "opacity-40"
                      } ${isSelected ? "bg-[var(--fg-overlay-05)]" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!selectable || importing}
                        onChange={() => toggleRow(i)}
                        aria-label={t("table.selectRow", { name: rowName(row) })}
                        className="mt-5 w-4 h-4 flex-shrink-0 accent-[var(--foreground)] disabled:cursor-default"
                      />
                      {previewImage(row)}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] leading-[19px] font-medium text-[var(--foreground)] line-clamp-2 break-words">{row.name || "—"}</p>
                        <p className="text-[12px] leading-[17px] text-[var(--foreground-muted)] truncate">
                          {[row.brand || "—", price, ...(gender ? [gender] : [])].join(" · ")}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {statusBadge(row)}
                          {categorySelect(row, i)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <DataTable<PreviewItem>
                label={t("import.preview.label")}
                rows={displayRows.map((row, i) => ({ row, i }))}
                rowKey={(item) => String(item.i)}
                columns={previewColumns}
                // One page: the preview shows its first rows, then "show all" below.
                pageSize={Math.max(displayRows.length, 1)}
                // A click on a row ticks it; the box and the category keep their own.
                onRowClick={({ row, i }) => {
                  if (isSelectable(row) && !importing) toggleRow(i);
                }}
                selection={{
                  selected: selectedKeys,
                  // The selection is what is being imported: it holds still during a run.
                  onToggle: (id) => {
                    if (!importing) toggleRow(Number(id));
                  },
                  onToggleAll: () => {
                    if (importing) return;
                    if (selected.size === selectableCount) setSelected(new Set<number>());
                    else selectAllRows();
                  },
                  allSelected: selectableCount > 0 && selected.size === selectableCount,
                  someSelected: selected.size > 0,
                  rowLabel: ({ row }) => rowName(row),
                  canSelect: ({ row }) => isSelectable(row),
                }}
              />
            )}

            {previewRows.length > PREVIEW_LIMIT && !showAll && (
              <div className="text-center py-2">
                <button onClick={() => setShowAll(true)} className={btn("ghost")}>
                  {t("import.preview.showAll", { limit: PREVIEW_LIMIT, count: previewRows.length })}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminPage>
  );
}
