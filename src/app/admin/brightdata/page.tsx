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
  category: Category;
  gender?: "men" | "women" | "unisex";
  price: number;
  currency: string;
  imageUrl: string;
  referralUrl: string;
  colors: string[];
  material: string;
  description: string;
  _valid: boolean;
  _issues: string[];
}

type ImportResult = { imported: number; skipped: number; errors: { name: string; error: string }[] };

const labelCls = "block text-[9px] uppercase tracking-[0.16em] text-[var(--foreground-muted)] mb-1";

export default function CSVImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState<CSVMappedRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set<number>());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError("");
    setRows([]);
    setResult(null);
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

      setDetectedColumns(data.columns ?? []);
      setRows(data.rows);
      setSelected(new Set(
        (data.rows as CSVMappedRow[])
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => r._valid)
          .map(({ i }) => i)
      ));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse CSV");
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!selected.size) return;
    setImporting(true);
    setResult(null);
    try {
      const toImport = Array.from(selected).map((i) => rows[i]);
      const res = await fetch("/api/admin/csv-import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: toImport }),
      });
      const data = await res.json();
      if (!res.ok) { setParseError(data.error ?? "Import failed"); return; }
      setResult(data);
      setRows([]);
      setSelected(new Set());
      setFileName("");
    } finally {
      setImporting(false);
    }
  };

  const toggleRow = (i: number) =>
    setSelected((prev: Set<number>) => {
      const next = new Set<number>(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const validCount = rows.filter((r) => r._valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-[9px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-1">
          Admin / Import
        </p>
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">
          CSV Import
        </h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1.5 tracking-wide">
          Upload a CSV file to bulk-import products into the catalog.
        </p>
      </div>

      {/* Column mapping reference */}
      <div className="border border-[var(--border)] p-4 text-xs text-[var(--foreground-muted)] space-y-1.5 leading-relaxed">
        <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">Expected columns (case-insensitive)</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 font-mono text-[10px] mt-2">
          <span><span className="text-[var(--foreground)]">name</span> / product_name / title → name</span>
          <span><span className="text-[var(--foreground)]">brand</span> / brand_name → brand</span>
          <span><span className="text-[var(--foreground)]">price</span> → price</span>
          <span><span className="text-[var(--foreground)]">currency</span> → currency (default EUR)</span>
          <span><span className="text-[var(--foreground)]">image</span> / image_url / photo → image</span>
          <span><span className="text-[var(--foreground)]">url</span> / link / referral_url / affiliate_url → referral link</span>
          <span><span className="text-[var(--foreground)]">category</span> → category (auto-inferred if missing)</span>
          <span><span className="text-[var(--foreground)]">gender</span> → men / women / unisex</span>
          <span><span className="text-[var(--foreground)]">color</span> / colour → color</span>
          <span><span className="text-[var(--foreground)]">material</span> / composition → material</span>
          <span><span className="text-[var(--foreground)]">description</span> / desc → description</span>
        </div>
      </div>

      {/* File upload */}
      {!rows.length && !result && (
        <div className="space-y-3">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[var(--border)] hover:border-[var(--border-strong)] transition-colors cursor-pointer flex flex-col items-center justify-center py-12 gap-3"
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              Parsing CSV…
            </div>
          )}
          {parseError && <p className="text-xs text-red-400 font-mono">{parseError}</p>}
        </div>
      )}

      {/* Import result */}
      {result && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 space-y-3">
          <p className="text-emerald-400 text-sm font-medium">
            Imported {result.imported} product{result.imported !== 1 ? "s" : ""}
            {result.skipped > 0 && ` · ${result.skipped} skipped`}
            {result.errors.length > 0 && ` · ${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}`}
          </p>
          {result.errors.length > 0 && (
            <ul className="text-xs text-red-400 font-mono space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i}>{e.name}: {e.error}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-3 pt-1">
            <a
              href="/admin/products"
              className="text-[10px] tracking-[0.14em] uppercase bg-[var(--foreground)] text-[var(--background)] px-5 py-2 hover:opacity-80 transition-opacity"
            >
              View products
            </a>
            <button
              onClick={() => setResult(null)}
              className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] px-5 py-2 hover:bg-[var(--surface)] transition-colors text-[var(--foreground)]"
            >
              Import another file
            </button>
          </div>
        </div>
      )}

      {/* Detected columns */}
      {rows.length > 0 && detectedColumns.length > 0 && (
        <div className="border border-[var(--border)] px-4 py-3 flex items-center gap-2 flex-wrap">
          <span className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">Detected columns:</span>
          {detectedColumns.map((col) => (
            <span key={col} className="text-[10px] font-mono text-[var(--foreground-muted)] bg-[var(--surface)] px-2 py-0.5 border border-[var(--border)]">
              {col}
            </span>
          ))}
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <span className="text-xs text-[var(--foreground-muted)]">
                {rows.length} rows · <span className="text-emerald-500">{validCount} valid</span>
                {invalidCount > 0 && <> · <span className="text-red-400">{invalidCount} invalid</span></>}
                {" · "}{selected.size} selected
              </span>
              <button
                onClick={() => setSelected(new Set<number>(rows.map((r, i) => r._valid ? i : -1).filter((i): i is number => i >= 0)))}
                className="text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Select valid
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
                onClick={() => { setRows([]); setSelected(new Set<number>()); setFileName(""); }}
                className="text-[10px] uppercase tracking-[0.1em] border border-[var(--border)] px-4 py-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                Back
              </button>
              {selected.size > 0 && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2 px-5 py-2 bg-[var(--foreground)] text-[var(--background)] text-[10px] tracking-[0.14em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {importing ? (
                    <>
                      <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      Importing…
                    </>
                  ) : (
                    `Import ${selected.size} product${selected.size !== 1 ? "s" : ""}`
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
                  <th className="w-10 px-3 py-2.5 text-left"><span className="sr-only">Select</span></th>
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
                {rows.map((row, i) => {
                  const isSelected = selected.has(i);
                  return (
                    <tr
                      key={i}
                      onClick={() => row._valid && toggleRow(i)}
                      className={`border-b border-[var(--border)] last:border-0 transition-colors ${
                        row._valid ? "cursor-pointer" : "opacity-50"
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
                        {row.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.imageUrl} alt={row.name} className="w-10 h-14 object-cover bg-[var(--surface)]" />
                        ) : (
                          <div className="w-10 h-14 bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-subtle)] text-[8px]">—</div>
                        )}
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
                            setRows((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], category: e.target.value as Category };
                              return next;
                            });
                          }}
                          className="text-[10px] bg-transparent border-0 text-[var(--foreground-muted)] cursor-pointer focus:outline-none"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-2 text-[var(--foreground-muted)] whitespace-nowrap">{row.gender ?? "—"}</td>

                      <td className="px-3 py-2 text-[var(--foreground)] whitespace-nowrap font-mono text-[10px]">
                        {row.price > 0 ? `${row.price} ${row.currency}` : "—"}
                      </td>

                      <td className="px-3 py-2 max-w-[140px]">
                        {row.referralUrl ? (
                          <span className="text-[9px] text-emerald-500 truncate block" title={row.referralUrl}>✓ link</span>
                        ) : (
                          <span className="text-[9px] text-[var(--foreground-subtle)]">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        {row._valid ? (
                          <span className="text-[9px] tracking-[0.12em] uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5">OK</span>
                        ) : (
                          <span
                            className="text-[9px] tracking-[0.12em] uppercase text-red-400 bg-red-400/10 px-2 py-0.5 cursor-help"
                            title={row._issues.join("; ")}
                          >
                            Error
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
