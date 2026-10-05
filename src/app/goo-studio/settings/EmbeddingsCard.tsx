"use client";

import { useState, useEffect, useRef } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { btn } from "../_ui/recipes";
import { useT } from "../_i18n";
import { Spinner, LoadingLine, sayFailure, withSlots, type Failure } from "./recipes";
import { FormSection } from "@/components/admin/FormSection";

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
  const t = useT();
  const confirm = useConfirm();
  const help = useHelp("settings-embeddings");
  const [coverage, setCoverage] = useState<EmbeddingCoverage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<Failure>("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; failed: number } | null>(null);
  const [runError, setRunError] = useState<Failure>("");
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
        setLoadError(json?.error || { key: "settings.embed.loadFailed", vars: { status: res.status } });
        return;
      }
      setCoverage(json as EmbeddingCoverage);
    } catch {
      setLoadError({ key: "settings.unreachable" });
    } finally {
      setLoading(false);
    }
  }

  async function backfill() {
    if (!coverage) return;
    // A mass operation billed to the OpenAI key: say how much before starting.
    const batches = Math.ceil(coverage.missing / EMBED_BATCH);
    if (
      !(await confirm({
        title: t("settings.embed.confirm", { count: coverage.missing }),
        body: t("settings.embed.confirmBody", { count: batches }),
        confirmLabel: t("settings.embed.confirmAction", { count: coverage.missing }),
      }))
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
          setRunError(json?.error || { key: "settings.embed.backfillFailed", vars: { status: res.status } });
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
          if (!json.firstError) setRunError({ key: "settings.embed.emptyBatch" });
          break;
        }
        if (json.remaining == null) {
          if (!json.firstError) setRunError({ key: "settings.embed.unknownLeft" });
          break;
        }
      }
    } catch {
      setRunError({ key: "settings.embed.networkSaved" });
    } finally {
      setRunning(false);
      setStopping(false);
      stopRequested.current = false;
      loadCoverage();
    }
  }

  return (
    <FormSection
      id="embeddings"
      title={t("settings.embed.title")}
      description={t("settings.embed.description")}
      extra={<HelpButton help={help} label={t("settings.embed.helpLabel")} />}
    >
      {help.open && (
        <HelpPanel help={help}>
          <p>
            {withSlots(t("settings.embed.help"), {
              knn: <span className="font-mono">{"?knn=1"}</span>,
              env: <code className="font-mono text-[11px]">{"STYLIST_SEMANTIC_SEARCH"}</code>,
            })}
          </p>
        </HelpPanel>
      )}

      <div>
        {loading && !coverage && <LoadingLine label={t("settings.embed.checking")} />}
        {loadError && <p className="text-[11px] text-[var(--err)]">{sayFailure(loadError, t)}</p>}

        {coverage && (
          <>
            <p className="text-[11px] text-[var(--foreground)] tabular-nums">
              {t("settings.embed.coverage", { done: coverage.withEmbedding, count: coverage.total, pct: coverage.coverage })}
            </p>
            <div
              className="mt-2 h-1.5 rounded-full bg-[var(--background)] overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={coverage.coverage}
              aria-label={t("settings.embed.coverageLabel")}
            >
              <div className="h-full bg-[var(--foreground)] transition-all" style={{ width: `${coverage.coverage}%` }} />
            </div>
            {coverage.missing > 0 && (
              <p className="text-[11px] text-[var(--foreground-muted)] mt-2 tabular-nums">
                {t("settings.embed.missing", { count: coverage.missing })}
              </p>
            )}
          </>
        )}

        {progress && (running || progress.processed > 0 || progress.failed > 0) && (
          <p className="text-[11px] text-[var(--foreground-muted)] mt-2 tabular-nums">
            {t("settings.embed.run", { count: progress.processed })}
            {progress.failed > 0 && (
              <>
                {" · "}
                <span className="text-[var(--err)]">{t("settings.embed.runFailed", { count: progress.failed })}</span>
              </>
            )}
          </p>
        )}
        {runDone && <p className="text-[11px] text-[var(--ok)] mt-2">{t("settings.embed.done")}</p>}
        {runError && <p className="text-[11px] text-[var(--err)] mt-2">{sayFailure(runError, t)}</p>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={backfill}
          disabled={running || !coverage || coverage.missing === 0}
          className={btn("primary")}
        >
          {running && <Spinner />}
          {running ? t("settings.embed.embedding") : t("settings.embed.backfill")}
        </button>
        {running ? (
          <button
            onClick={() => { stopRequested.current = true; setStopping(true); }}
            disabled={stopping}
            className={btn("secondary")}
          >
            {stopping ? t("settings.embed.stopping") : t("settings.embed.stop")}
          </button>
        ) : (
          <button onClick={loadCoverage} disabled={loading} className={btn("secondary")}>
            {loading ? t("settings.checking") : t("settings.embed.refresh")}
          </button>
        )}
      </div>
    </FormSection>
  );
}
