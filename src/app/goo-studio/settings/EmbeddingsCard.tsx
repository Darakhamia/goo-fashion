"use client";

import { useState, useEffect, useRef } from "react";
import { PRIMARY_BTN, SECONDARY_BTN, Spinner, LoadingLine } from "./recipes";

interface EmbeddingCoverage {
  total: number;
  withEmbedding: number;
  missing: number;
  coverage: number;
}

/** Products per backfill request; the route caps it at 200. */
const EMBED_BATCH = 100;

/**
 * Coverage of product embeddings and a backfill for the missing ones.
 *
 * Imports do not embed new products, so without this the stylist's semantic
 * search (and field-mining's ?knn=1) only ever sees the products someone
 * embedded by hand. The backfill runs in batches, one request each, so it shows
 * progress and can be stopped between batches.
 */
export default function EmbeddingsCard() {
  const [coverage, setCoverage] = useState<EmbeddingCoverage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; failed: number } | null>(null);
  const [runError, setRunError] = useState("");
  const [runDone, setRunDone] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stopRequested = useRef(false);

  useEffect(() => {
    loadCoverage();
  }, []);

  // Leaving the page ends the run after the batch in flight, instead of the
  // loop spending the key on batches nobody is watching.
  useEffect(() => {
    return () => {
      stopRequested.current = true;
    };
  }, []);

  async function loadCoverage() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/embeddings", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(json?.error || `Could not load coverage (${res.status})`);
        return;
      }
      setCoverage(json as EmbeddingCoverage);
    } catch {
      setLoadError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function backfill() {
    if (!coverage) return;
    // A mass operation billed to the OpenAI key: say how much before starting.
    const batches = Math.ceil(coverage.missing / EMBED_BATCH);
    if (
      !confirm(
        `Embed ${coverage.missing} product${coverage.missing === 1 ? "" : "s"}?\n\nThis sends ${batches} request${batches === 1 ? "" : "s"} to OpenAI, billed to the key above. You can stop between batches.`
      )
    ) return;
    stopRequested.current = false;
    setStopping(false);
    setRunning(true);
    setRunError("");
    setRunDone(false);
    let processed = 0;
    let failed = 0;
    setProgress({ processed, failed });
    try {
      while (!stopRequested.current) {
        const res = await fetch("/api/admin/embeddings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: EMBED_BATCH }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRunError(json?.error || `Backfill failed (${res.status})`);
          break;
        }
        processed += Number(json.processed) || 0;
        failed += Number(json.failed) || 0;
        setProgress({ processed, failed });
        if (typeof json.remaining === "number") {
          const left = json.remaining as number;
          setCoverage((prev) =>
            prev
              ? {
                  ...prev,
                  missing: left,
                  withEmbedding: prev.total - left,
                  coverage: prev.total > 0 ? Math.round(((prev.total - left) / prev.total) * 100) : 0,
                }
              : prev
          );
        }
        if (json.firstError) setRunError(String(json.firstError));
        if (json.done) {
          setRunDone(true);
          break;
        }
        // A batch that embedded nothing would be picked again next time and
        // fail the same way — stop instead of looping on it.
        if (!json.processed) {
          if (!json.firstError) setRunError("The last batch embedded nothing; stopped.");
          break;
        }
        if (json.remaining == null) {
          if (!json.firstError) setRunError("Could not tell how many products are left; stopped.");
          break;
        }
      }
    } catch {
      setRunError("Network error. The batches already finished are saved.");
    } finally {
      setRunning(false);
      setStopping(false);
      stopRequested.current = false;
      loadCoverage();
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] mt-6">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="3" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4.1 9.9L9.9 4.1M4.5 11H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
            Embeddings
          </p>
        </div>
        <p className="text-[11px] text-[var(--foreground-muted)] mt-1.5 leading-relaxed">
          Vectors behind the stylist&apos;s semantic search and the <span className="font-mono">?knn=1</span> mode of
          field mining. Imports don&apos;t create them, so new products stay without one until a backfill runs here. The
          chat searches by meaning only when the server has <code className="font-mono text-[10px]">STYLIST_SEMANTIC_SEARCH</code>{" "}
          on; otherwise it uses keyword search. Uses the OpenAI key above.
        </p>
      </div>

      <div className="px-5 py-4">
        {loading && !coverage && <LoadingLine label="Checking coverage…" />}
        {loadError && <p className="text-[11px] text-red-500">{loadError}</p>}

        {coverage && (
          <>
            <p className="text-[11px] text-[var(--foreground)]">
              <span className="tabular-nums">{coverage.withEmbedding}</span> of{" "}
              <span className="tabular-nums">{coverage.total}</span> products embedded ·{" "}
              <span className="tabular-nums">{coverage.coverage}%</span>
            </p>
            <div
              className="mt-2 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={coverage.coverage}
              aria-label="Embedding coverage"
            >
              <div className="h-full bg-[var(--foreground)] transition-all" style={{ width: `${coverage.coverage}%` }} />
            </div>
            {coverage.missing > 0 && (
              <p className="text-[11px] text-[var(--foreground-muted)] mt-2">
                <span className="tabular-nums">{coverage.missing}</span> without an embedding.
              </p>
            )}
          </>
        )}

        {progress && (running || progress.processed > 0 || progress.failed > 0) && (
          <p className="text-[11px] text-[var(--foreground-muted)] mt-2">
            This run: <span className="tabular-nums">{progress.processed}</span> embedded
            {progress.failed > 0 && (
              <>
                {" "}· <span className="tabular-nums text-red-500">{progress.failed}</span> failed
              </>
            )}
          </p>
        )}
        {runDone && <p className="text-[11px] text-emerald-500 mt-2">Every product has an embedding.</p>}
        {runError && <p className="text-[11px] text-red-500 mt-2">{runError}</p>}
      </div>

      <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center gap-2 flex-wrap">
        <button
          onClick={backfill}
          disabled={running || !coverage || coverage.missing === 0}
          className={PRIMARY_BTN}
        >
          {running && <Spinner />}
          {running ? "Embedding…" : "Backfill missing"}
        </button>
        {running ? (
          <button
            onClick={() => { stopRequested.current = true; setStopping(true); }}
            disabled={stopping}
            className={SECONDARY_BTN}
          >
            {stopping ? "Stopping after this batch…" : "Stop after this batch"}
          </button>
        ) : (
          <button onClick={loadCoverage} disabled={loading} className={SECONDARY_BTN}>
            {loading ? "Checking…" : "Refresh"}
          </button>
        )}
      </div>
    </div>
  );
}
