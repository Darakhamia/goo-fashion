"use client";

import { useState } from "react";
import type { BDMappedRow } from "@/app/api/admin/brightdata-import/route";

const CATEGORIES = [
  "outerwear","blazers","tops","shirts","knitwear","bottoms","jeans",
  "shorts","skirts","dresses","jumpsuits","swimwear","footwear","bags","accessories",
] as const;

const inputCls = "w-full px-2.5 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]";
const labelCls = "block text-[9px] uppercase tracking-[0.16em] text-[var(--foreground-muted)] mb-1";

type ImportResult = { imported: number; skipped: number; errors: { name: string; error: string }[] };

export default function BrightDataImportPage() {
  const [json, setJson] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState<BDMappedRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rawRecords, setRawRecords] = useState<unknown[]>([]);

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // ── Parse & preview ──
  const handlePreview = async () => {
    setParseError("");
    setRows([]);
    setResult(null);
    setParsing(true);
    try {
      let records: unknown[];
      try {
        records = JSON.parse(json.trim());
        if (!Array.isArray(records)) throw new Error("JSON must be an array");
      } catch (e) {
        setParseError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }

      const res = await fetch("/api/admin/brightdata-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, records }),
      });
      const data = await res.json();
      if (!res.ok) { setParseError(data.error ?? "Preview failed"); return; }

      setRawRecords(records);
      setRows(data.rows);
      // Pre-select all valid rows
      setSelected(new Set(
        (data.rows as BDMappedRow[])
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => r._valid)
          .map(({ i }) => i)
      ));
    } finally {
      setParsing(false);
    }
  };

  // ── Import ──
  const handleImport = async () => {
    if (!selected.size) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/brightdata-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: rawRecords,
          indices: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setParseError(data.error ?? "Import failed"); return; }
      setResult(data);
      setRows([]);
      setSelected(new Set());
      setJson("");
    } finally {
      setImporting(false);
    }
  };

  const toggleRow = (i: number) =>
    setSelected((prev: Set<number>) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const selectAllValid = () =>
    setSelected(new Set(
      rows
        .map((r: BDMappedRow, i: number) => ({ r, i }))
        .filter(({ r }: { r: BDMappedRow; i: number }) => r._valid)
        .map(({ i }: { r: BDMappedRow; i: number }) => i)
    ));

  const clearAll = () => setSelected(new Set<number>());

  const validCount = rows.filter((r: BDMappedRow) => r._valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-[9px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-1">
          Admin / Imports
        </p>
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">
          BrightData Import
        </h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1.5 tracking-wide">
          Paste a BrightData JSON dataset to preview and bulk-import products into the catalog.
        </p>
      </div>

      {/* How-to banner */}
      <div className="border border-[var(--border)] p-4 text-xs text-[var(--foreground-muted)] space-y-1.5 leading-relaxed">
        <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">Field mapping</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 font-mono text-[10px] mt-2">
          <span><span className="text-[var(--foreground)]">product_name</span> → name</span>
          <span><span className="text-[var(--foreground)]">brand</span> → brand</span>
          <span><span className="text-[var(--foreground)]">price.value / currency</span> → price / currency</span>
          <span><span className="text-[var(--foreground)]">composition</span> → material</span>
          <span><span className="text-[var(--foreground)]">main_image</span> → image (1000px)</span>
          <span><span className="text-[var(--foreground)]">product_images[]</span> → images (→1000px)</span>
          <span><span className="text-[var(--foreground)]">product_features[0]</span> → color</span>
          <span><span className="text-[var(--foreground)]">farfetch_id</span> → source URL</span>
          <span><span className="text-[var(--foreground)]">input.url</span> → gender (men/women)</span>
          <span><span className="text-[var(--foreground)]">product_name</span> → category (inferred)</span>
        </div>
      </div>

      {/* JSON input */}
      {!rows.length && !result && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>BrightData JSON (paste array)</label>
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              rows={14}
              placeholder={'[\n  { "product_name": "...", "brand": "...", ... },\n  ...\n]'}
              className={`${inputCls} font-mono resize-y`}
            />
          </div>
          {parseError && <p className="text-xs text-red-400 font-mono">{parseError}</p>}
          <button
            onClick={handlePreview}
            disabled={!json.trim() || parsing}
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--foreground)] text-[var(--background)] text-[10px] tracking-[0.16em] uppercase hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {parsing ? (
              <>
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                Parsing…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Preview
              </>
            )}
          </button>
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
              Import another dataset
            </button>
          </div>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <span className="text-xs text-[var(--foreground-muted)]">
                {rows.length} records · <span className="text-emerald-500">{validCount} valid</span>
                {invalidCount > 0 && <> · <span className="text-red-400">{invalidCount} invalid</span></>}
                {" · "}{selected.size} selected
              </span>
              <button
                onClick={selectAllValid}
                className="text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Select valid
              </button>
              {selected.size > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setRows([]); setSelected(new Set()); setRawRecords([]); }}
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

          {/* Table */}
          <div className="border border-[var(--border)] overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="w-10 px-3 py-2.5 text-left">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Image</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Name</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Brand</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Category</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Gender</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Price</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] font-normal">Color</th>
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
                      {/* Checkbox */}
                      <td className="px-3 py-2">
                        <div className={`w-4 h-4 border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-[var(--foreground)] border-[var(--foreground)]"
                            : "border-[var(--border)]"
                        }`}>
                          {isSelected && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 4L3 5.5L6.5 2" stroke="var(--background)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </td>

                      {/* Image */}
                      <td className="px-3 py-2">
                        {row.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.imageUrl}
                            alt={row.name}
                            className="w-10 h-14 object-cover bg-[var(--surface)]"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-subtle)] text-[8px]">
                            —
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2 max-w-[220px]">
                        <p className="text-[var(--foreground)] leading-snug line-clamp-2">{row.name || "—"}</p>
                        {row.farfetchId && (
                          <p className="text-[9px] text-[var(--foreground-subtle)] font-mono mt-0.5">#{row.farfetchId}</p>
                        )}
                      </td>

                      {/* Brand */}
                      <td className="px-3 py-2 text-[var(--foreground-muted)] whitespace-nowrap">{row.brand || "—"}</td>

                      {/* Category */}
                      <td className="px-3 py-2">
                        <select
                          value={row.category}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            setRows((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], category: e.target.value as typeof row.category };
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

                      {/* Gender */}
                      <td className="px-3 py-2 text-[var(--foreground-muted)] whitespace-nowrap">
                        {row.gender ?? "—"}
                      </td>

                      {/* Price */}
                      <td className="px-3 py-2 text-[var(--foreground)] whitespace-nowrap font-mono text-[10px]">
                        {row.price > 0 ? `${row.price} ${row.currency}` : "—"}
                      </td>

                      {/* Color */}
                      <td className="px-3 py-2 text-[var(--foreground-muted)] text-[10px] max-w-[100px]">
                        <span className="truncate block">{row.colors[0] ?? "—"}</span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2">
                        {row._valid ? (
                          <span className="text-[9px] tracking-[0.12em] uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5">
                            OK
                          </span>
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
