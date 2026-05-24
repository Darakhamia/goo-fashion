"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface ImportedProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  image_url: string;
  status: string;
  source_url: string;
}

interface ImportJob {
  id: string;
  url: string;
  status: "pending" | "processing" | "done" | "failed";
  error: string | null;
  result_product_id: string | null;
  created_at: string;
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)]";
const labelCls = "block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5";

function StatusBadge({ status }: { status: ImportJob["status"] }) {
  const map: Record<ImportJob["status"], string> = {
    pending: "text-[var(--foreground-muted)] border-[var(--border)]",
    processing: "text-amber-400 border-amber-400/40 bg-amber-400/5",
    done: "text-emerald-400 border-emerald-500/40 bg-emerald-500/5",
    failed: "text-red-400 border-red-400/40 bg-red-400/5",
  };
  return (
    <span className={`text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 border ${map[status]}`}>
      {status}
    </span>
  );
}

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportedProduct | null>(null);

  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/import");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs ?? []);
      }
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setResult(data.product);
      await fetchJobs();
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setUrl("");
    setResult(null);
    setError("");
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">URL Importer</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
          Paste any product URL — we extract data automatically and save it as a draft.
        </p>
      </div>

      {/* Import box */}
      <div className="border border-[var(--border)] p-5 space-y-4" style={{ background: "var(--background)" }}>
        <div>
          <label className={labelCls}>Product URL</label>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleImport()}
              placeholder="https://www.farfetch.com/…  or  https://www.ssense.com/…"
              className={`${inputCls} flex-1`}
              disabled={loading}
            />
            <button
              onClick={handleImport}
              disabled={!url.trim() || loading}
              className="shrink-0 px-6 py-2 bg-[var(--foreground)] text-[var(--background)] text-xs tracking-[0.14em] uppercase hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  Importing…
                </>
              ) : (
                "Import"
              )}
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-xs text-[var(--foreground-muted)] animate-pulse">
            Fetching page and extracting product data…
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 border border-red-400/30 bg-red-400/5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-px text-red-400">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4.5V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="7" cy="9.5" r="0.7" fill="currentColor" />
            </svg>
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="border border-emerald-500/30 bg-emerald-500/5 p-4 flex gap-4 items-start">
            {/* Thumbnail */}
            {result.image_url && (
              <div className="relative w-16 h-20 shrink-0 border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
                <Image src={result.image_url} alt={result.name} fill className="object-cover" sizes="64px" unoptimized />
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)]">{result.brand}</p>
              <p className="text-sm text-[var(--foreground)] leading-snug line-clamp-2">{result.name}</p>
              <p className="text-xs text-[var(--foreground-muted)]">
                {result.currency} {result.price > 0 ? result.price : "—"}
                <span className="mx-2 text-[var(--border-strong)]">·</span>
                <span className="uppercase text-[10px] tracking-[0.1em]">{result.category}</span>
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 border border-amber-400/40 bg-amber-400/5 text-amber-400">
                  draft
                </span>
                <span className="text-emerald-400 text-xs">Saved successfully</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <Link
                href={`/goo-studio/products`}
                className="text-[10px] tracking-[0.12em] uppercase bg-[var(--foreground)] text-[var(--background)] px-3 py-1.5 hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                Review in Products
              </Link>
              <button
                onClick={reset}
                className="text-[10px] tracking-[0.12em] uppercase border border-[var(--border)] px-3 py-1.5 text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                Import another
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Supported platforms hint */}
      <div className="px-4 py-3 border border-[var(--border)] flex items-start gap-3">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-px text-[var(--foreground-muted)]">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 6V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="4.5" r="0.7" fill="currentColor" />
        </svg>
        <p className="text-xs text-[var(--foreground-muted)]">
          Works best with sites that expose{" "}
          <span className="text-[var(--foreground)]">JSON-LD structured data</span> (Farfetch, SSENSE, Mytheresa, Net-a-Porter, Zara…).
          Open Graph tags are used as fallback. Pages behind login or heavy bot protection may fail.
        </p>
      </div>

      {/* Recent import jobs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Recent imports</h2>
          <button
            onClick={fetchJobs}
            className="text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
          {jobsLoading ? (
            <div className="px-5 py-8 text-center">
              <span className="inline-block w-4 h-4 border border-current border-t-transparent rounded-full animate-spin text-[var(--foreground-muted)]" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="px-5 py-8 text-xs text-[var(--foreground-muted)] text-center">No imports yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)] font-normal">URL</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)] font-normal w-28">Status</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)] font-normal w-36">Date</th>
                  <th className="px-4 py-2.5 w-24" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr
                    key={job.id}
                    className={`border-b border-[var(--border)] last:border-b-0 ${i % 2 === 1 ? "bg-[var(--surface)]/40" : ""}`}
                  >
                    <td className="px-4 py-3 text-[var(--foreground-muted)] max-w-[260px]">
                      <span className="block truncate" title={job.url}>
                        {job.url}
                      </span>
                      {job.error && (
                        <span className="block text-[10px] text-red-400 mt-0.5 truncate">{job.error}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground-muted)] whitespace-nowrap">
                      {new Date(job.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {job.result_product_id && (
                        <Link
                          href={`/goo-studio/products`}
                          className="text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
                        >
                          View draft
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
