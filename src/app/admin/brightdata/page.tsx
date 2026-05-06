"use client";

import React, { useRef, useState } from "react";

const CATEGORIES = [
  "outerwear","blazers","tops","shirts","knitwear","bottoms","jeans",
  "shorts","skirts","dresses","jumpsuits","swimwear","footwear","bags","accessories",
] as const;

type Category = typeof CATEGORIES[number];

export interface CSVMappedRow {
  name: string;
  brand: string;
  merchant: string;
  category: Category;
  gender?: "men" | "women" | "unisex";
  price: number;
  priceOriginal: number;
  currency: string;
  imageUrl: string;
  images: string[];
  referralUrl: string;
  colors: string[];
  material: string;
  description: string;
  _valid: boolean;
  _issues: string[];
}

interface Merchant { name: string; count: number; validCount: number; }
type ImportResult = { imported: number; skipped: number; errors: { name: string; error: string }[] };
type Step = "upload" | "merchants" | "preview";

export default function CSVImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // All rows from CSV (kept in memory)
  const [allRows, setAllRows] = useState<CSVMappedRow[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchants, setSelectedMerchants] = useState<Set<string>>(new Set<string>());

  // Preview state
  const [previewRows, setPreviewRows] = useState<CSVMappedRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set<number>());
  const [showAll, setShowAll] = useState(false);

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // ── Step 1: Upload & parse ──────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError("");
    setParsing(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/csv-import", {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) { setParseError(data.error ?? "Parse failed"); return; }

      setAllRows(data.rows);
      setMerchants(data.merchants ?? []);
      setSelectedMerchants(new Set<string>());
      setStep("merchants");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse CSV");
    } finally {
      setParsing(false);
    }
  };

  // ── Step 2 → 3: Apply merchant filter ──────────────────────────────────────
  const applyMerchantFilter = () => {
    const filtered = allRows.filter((r) => selectedMerchants.has(r.merchant || "Unknown"));
    setPreviewRows(filtered);
    setSelected(new Set<number>(
      filtered.map((r, i) => r._valid ? i : -1).filter((i): i is number => i >= 0)
    ));
    setShowAll(false);
    setStep("preview");
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    const rows = Array.from(selected).map((i) => previewRows[i]);
    if (!rows.length) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/csv-import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) { setParseError(data.error ?? "Import failed"); return; }
      setResult(data);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFileName("");
    setAllRows([]);
    setMerchants([]);
    setSelectedMerchants(new Set<string>());
    setPreviewRows([]);
    setSelected(new Set<number>());
    setResult(null);
    setParseError("");
  };

  const toggleRow = (i: number) =>
    setSelected((prev: Set<number>) => {
      const next = new Set<number>(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const toggleMerchant = (name: string) =>
    setSelectedMerchants((prev: Set<string>) => {
      const next = new Set<string>(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const validCount = previewRows.filter((r) => r._valid).length;
  const PREVIEW_LIMIT = 200;
  const displayRows = showAll ? previewRows : previewRows.slice(0, PREVIEW_LIMIT);

  // ── Selected merchants stats ────────────────────────────────────────────────
  const selMerchantStats = merchants.filter((m) => selectedMerchants.has(m.name));
  const selTotal = selMerchantStats.reduce((s, m) => s + m.count, 0);
  const selValid = selMerchantStats.reduce((s, m) => s + m.validCount, 0);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-[9px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-1">
          Admin / Import
        </p>
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">CSV Import</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
          Upload an affiliate product feed (Awin, etc.) to bulk-import products.
        </p>
      </div>

      {/* Step indicators */}
      {step !== "upload" && (
        <div className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)]">
          <span className={step === "merchants" ? "text-[var(--foreground)]" : ""}>1. Merchants</span>
          <span className="text-[var(--border-strong)]">→</span>
          <span className={step === "preview" ? "text-[var(--foreground)]" : ""}>2. Preview</span>
          <span className="text-[var(--border-strong)]">→</span>
          <span className={result ? "text-emerald-500" : ""}>3. Import</span>
          <button onClick={reset} className="ml-4 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
            ← Start over
          </button>
        </div>
      )}

      {/* ── STEP 1: Upload ── */}
      {step === "upload" && !result && (
        <div className="space-y-4">
          <div
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[var(--border)] hover:border-[var(--border-strong)] transition-colors cursor-pointer flex flex-col items-center justify-center py-16 gap-3"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-[var(--foreground-muted)]">
              <path d="M16 4V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M10 10L16 4L22 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 22V26H26V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {fileName ? (
              <p className="text-sm text-[var(--foreground)]">{fileName}</p>
            ) : (
              <>
                <p className="text-sm text-[var(--foreground-muted)]">Drop CSV file here or click to browse</p>
                <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide uppercase">.csv files only</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </div>
          {parsing && (
            <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              Parsing CSV…
            </div>
          )}
          {parseError && <p className="text-xs text-red-400">{parseError}</p>}

          {/* Supported columns reference */}
          <div className="border border-[var(--border)] p-4 text-[10px] text-[var(--foreground-muted)] space-y-2">
            <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">Supported feed columns</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 font-mono mt-1">
              <span><span className="text-[var(--foreground)]">product_name</span> → name</span>
              <span><span className="text-[var(--foreground)]">brand_name</span> / merchant_name → brand</span>
              <span><span className="text-[var(--foreground)]">search_price</span> / store_price → price</span>
              <span><span className="text-[var(--foreground)]">currency</span> → currency</span>
              <span><span className="text-[var(--foreground)]">large_image</span> / merchant_image_url → image</span>
              <span><span className="text-[var(--foreground)]">aw_deep_link</span> → referral link</span>
              <span><span className="text-[var(--foreground)]">category_name</span> → category + gender</span>
              <span><span className="text-[var(--foreground)]">colour</span> → color</span>
              <span><span className="text-[var(--foreground)]">in_stock</span> → filters out sold out</span>
              <span><span className="text-[var(--foreground)]">merchant_name</span> → merchant filter</span>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Merchant selector ── */}
      {step === "merchants" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--foreground)]">
                {allRows.length.toLocaleString()} rows · {merchants.length} merchant{merchants.length !== 1 ? "s" : ""} detected
              </p>
              <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">
                Select the merchants you want to import from.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedMerchants(new Set<string>(merchants.map((m) => m.name)))}
                className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Select all
              </button>
              <button
                onClick={() => setSelectedMerchants(new Set<string>())}
                className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
            {merchants.map((m, i) => {
              const isSelected = selectedMerchants.has(m.name);
              return (
                <div
                  key={m.name}
                  onClick={() => toggleMerchant(m.name)}
                  className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors border-b border-[var(--border)] last:border-0 ${
                    isSelected ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]/50"
                  }`}
                >
                  <div className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? "bg-[var(--foreground)] border-[var(--foreground)]" : "border-[var(--border-strong)]"
                  }`}>
                    {isSelected && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="var(--background)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--foreground)]">{m.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-[var(--foreground)] tabular-nums">{m.count.toLocaleString()} items</p>
                    <p className="text-[10px] text-emerald-500 tabular-nums">{m.validCount.toLocaleString()} valid</p>
                  </div>
                  <div className="w-24 flex-shrink-0">
                    <div className="h-1 bg-[var(--border)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--foreground-muted)]"
                        style={{ width: `${Math.round((m.count / allRows.length) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5 text-right">
                      {Math.round((m.count / allRows.length) * 100)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer CTA */}
          <div className="flex items-center justify-between pt-1">
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
            <button
              onClick={applyMerchantFilter}
              disabled={!selectedMerchants.size}
              className="px-6 py-2.5 bg-[var(--foreground)] text-[var(--background)] text-[10px] tracking-[0.16em] uppercase hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
              Preview {selValid > 0 ? `${selValid.toLocaleString()} products →` : "→"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Preview table ── */}
      {step === "preview" && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <span className="text-xs text-[var(--foreground-muted)]">
                {previewRows.length.toLocaleString()} rows ·{" "}
                <span className="text-emerald-500">{validCount.toLocaleString()} valid</span>
                {previewRows.length - validCount > 0 && (
                  <> · <span className="text-[var(--foreground-subtle)]">{(previewRows.length - validCount).toLocaleString()} skipped</span></>
                )}
                {" · "}{selected.size.toLocaleString()} selected
              </span>
              <button
                onClick={() => setSelected(new Set<number>(previewRows.map((r, i) => r._valid ? i : -1).filter((i): i is number => i >= 0)))}
                className="text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Select all valid
              </button>
              {selected.size > 0 && (
                <button
                  onClick={() => setSelected(new Set<number>())}
                  className="text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("merchants")}
                className="text-[10px] uppercase tracking-[0.1em] border border-[var(--border)] px-4 py-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                ← Merchants
              </button>
              {selected.size > 0 && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2 px-5 py-2 bg-[var(--foreground)] text-[var(--background)] text-[10px] tracking-[0.14em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {importing ? (
                    <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Importing…</>
                  ) : (
                    `Import ${selected.size.toLocaleString()} product${selected.size !== 1 ? "s" : ""}`
                  )}
                </button>
              )}
            </div>
          </div>

          {parseError && <p className="text-xs text-red-400">{parseError}</p>}

          <div className="border border-[var(--border)] overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="w-10 px-3 py-2.5"><span className="sr-only">Select</span></th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Image</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Name</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Brand</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Category</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Gender</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Price</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Link</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => {
                  const isSelected = selected.has(i);
                  return (
                    <tr
                      key={i}
                      onClick={() => row._valid && toggleRow(i)}
                      className={`border-b border-[var(--border)] last:border-0 transition-colors ${
                        row._valid ? "cursor-pointer" : "opacity-40 cursor-default"
                      } ${isSelected ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]/50"}`}
                    >
                      <td className="px-3 py-2">
                        <div className={`w-4 h-4 border flex items-center justify-center transition-colors ${
                          isSelected ? "bg-[var(--foreground)] border-[var(--foreground)]" : "border-[var(--border)]"
                        }`}>
                          {isSelected && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 4L3 5.5L6.5 2" stroke="var(--background)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          {row.imageUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={row.imageUrl} alt="" className="w-10 h-14 object-cover bg-[var(--surface)]" />
                            : <div className="w-10 h-14 bg-[var(--surface)]" />}
                          {row.images && row.images.length > 1 && (
                            <span className="absolute bottom-0 right-0 text-[8px] bg-[var(--foreground)] text-[var(--background)] px-0.5 leading-tight">
                              +{row.images.length - 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <p className="text-[var(--foreground)] leading-snug line-clamp-2">{row.name || "—"}</p>
                      </td>
                      <td className="px-3 py-2 text-[var(--foreground-muted)] whitespace-nowrap">{row.brand || "—"}</td>
                      <td className="px-3 py-2">
                        <select
                          value={row.category}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            setPreviewRows((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], category: e.target.value as Category };
                              return next;
                            });
                          }}
                          className="text-[10px] bg-transparent border-0 text-[var(--foreground-muted)] cursor-pointer focus:outline-none"
                        >
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-[var(--foreground-muted)] whitespace-nowrap text-[10px]">
                        {row.gender ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-[var(--foreground)] whitespace-nowrap font-mono text-[10px]">
                        {row.price > 0 ? `${row.price} ${row.currency}` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.referralUrl
                          ? <span className="text-[9px] text-emerald-500">✓ link</span>
                          : <span className="text-[9px] text-[var(--foreground-subtle)]">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {row._valid ? (
                          <span className="text-[9px] tracking-[0.12em] uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5">OK</span>
                        ) : (
                          <span className="text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] bg-[var(--surface)] px-2 py-0.5 cursor-help" title={row._issues.join("; ")}>
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
              <button
                onClick={() => setShowAll(true)}
                className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Showing first {PREVIEW_LIMIT} rows — show all {previewRows.length.toLocaleString()} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Result ── */}
      {result && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 space-y-3">
          <p className="text-emerald-400 text-sm font-medium">
            Imported {result.imported.toLocaleString()} product{result.imported !== 1 ? "s" : ""}
            {result.skipped > 0 && ` · ${result.skipped} skipped`}
            {result.errors.length > 0 && ` · ${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}`}
          </p>
          {result.errors.length > 0 && (
            <ul className="text-xs text-red-400 font-mono space-y-0.5 max-h-40 overflow-y-auto">
              {result.errors.map((e, i) => <li key={i}>{e.name}: {e.error}</li>)}
            </ul>
          )}
          <div className="flex gap-3 pt-1">
            <a href="/admin/products" className="text-[10px] tracking-[0.14em] uppercase bg-[var(--foreground)] text-[var(--background)] px-5 py-2 hover:opacity-80 transition-opacity">
              View products
            </a>
            <button onClick={reset} className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] px-5 py-2 hover:bg-[var(--surface)] transition-colors text-[var(--foreground)]">
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
