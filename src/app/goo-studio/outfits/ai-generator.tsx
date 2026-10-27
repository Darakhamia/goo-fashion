"use client";

/**
 * Outfits → Pending → Generate with AI (CEO, 2026-10-27).
 *
 * The dialog that asks the AI for outfits, the panel that follows a run while
 * its pictures are drawn, and the notes a generated look carries into the
 * review dialog. The work itself is on the server (lib/server/ai-outfits);
 * this only starts it and reads its progress from /api/admin/ai-outfits.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StyleKeyword } from "@/lib/types";
import { STYLE_KEYWORD_LIST, styleLabel } from "@/lib/style-keywords";
import { Modal } from "@/components/admin/Modal";
import { FilterChips } from "@/components/admin/FilterBar";
import { BANNER, btn, BTN_ICON, FIELD_LABEL, INPUT, PANEL } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT } from "@/app/goo-studio/_i18n";

export interface AiRun {
  id: string;
  status: "running" | "done" | "failed";
  requested: number;
  made: number;
  failed: number;
  log: { at: string; message: string }[];
  cost_usd: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

interface Ready {
  openai: boolean;
  replicate: boolean;
  database: boolean;
}

interface Options {
  brands: { name: string; count: number }[];
  colorGroups: { id: number; name: string; hexCode: string }[];
  maxOutfits: number;
}

/** What a generated look carries (`pending_looks.ai_meta`, lib/server/ai-outfits/run). */
export interface AiMeta {
  notes?: string;
  palette?: string[];
  copy?: { field: "name" | "description"; action: "replaced" | "tidied" | "noted"; problem: string; original?: string }[];
  imageError?: string;
}

/** How often a running run is read again. */
const POLL_MS = 4_000;

interface RunsReply {
  runs?: AiRun[];
  ready?: Ready;
  options?: Options;
}

/** The runs, and with `withOptions` what the form chooses from. Null when the read failed. */
async function fetchRuns(withOptions: boolean): Promise<RunsReply | null> {
  try {
    const res = await fetch(`/api/admin/ai-outfits${withOptions ? "?options=1" : ""}`, { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as RunsReply | null;
    return res.ok ? data : null;
  } catch {
    return null;
  }
}

/** The sparkle on the Generate button. */
export const SPARK = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.5l1.6 4.2 4.4 1.3-4.4 1.3L8 12.5 6.4 8.3 2 7l4.4-1.3L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M13 11.5l.5 1.3 1.3.4-1.3.4-.5 1.3-.5-1.3-1.3-.4 1.3-.4.5-1.3z" fill="currentColor" />
  </svg>
);

/**
 * The latest runs, read when asked and every few seconds while one is going.
 * `onProgress` is called when a running run makes another outfit or ends, so
 * the queue below can be read again and show it.
 */
export function useAiRuns(onProgress: () => void) {
  const [runs, setRuns] = useState<AiRun[]>([]);
  const [ready, setReady] = useState<Ready | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const seen = useRef<string>("");

  const apply = useCallback((data: RunsReply) => {
    setRuns(Array.isArray(data.runs) ? data.runs : []);
    if (data.ready) setReady(data.ready);
    if (data.options) setOptions(data.options);
  }, []);

  const load = useCallback(
    async (withOptions = false) => {
      const data = await fetchRuns(withOptions);
      if (data) apply(data);
    },
    [apply],
  );

  useEffect(() => {
    let alive = true;
    void fetchRuns(true).then((data) => {
      if (alive && data) apply(data);
    });
    return () => {
      alive = false;
    };
  }, [apply]);

  const latest = runs[0] ?? null;
  const running = latest?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, load]);

  // Another outfit made, or the run over: the queue has something new.
  useEffect(() => {
    if (!latest) return;
    const mark = `${latest.id}:${latest.made}:${latest.status}`;
    if (seen.current && seen.current !== mark) onProgress();
    seen.current = mark;
  }, [latest, onProgress]);

  return { runs, latest, ready, options, reload: load };
}

/** The latest run, at the top of Pending: progress while it runs, the outcome after. */
export function AiRunPanel({ run }: { run: AiRun }) {
  const t = useT();
  const f = useFormat();
  const [showLog, setShowLog] = useState(run.status !== "done");
  const tone = run.status === "failed" ? BANNER.err : run.status === "done" ? BANNER.ok : `${PANEL} px-4 py-3 text-[13px]`;
  const share = run.requested ? Math.min(1, run.made / run.requested) : 0;

  return (
    <div className={`${tone} mb-4`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-medium">
          {run.status === "running"
            ? t("outfits.ai.running", { made: run.made, requested: run.requested })
            : run.status === "done"
              ? t("outfits.ai.done", { made: run.made, requested: run.requested })
              : t("outfits.ai.failed")}
        </p>
        <span className="text-[12px] opacity-80 tabular-nums">
          {f.date(run.created_at)} · {t("outfits.ai.cost", { cost: `$${Number(run.cost_usd).toFixed(3)}` })}
        </span>
      </div>
      {run.status === "running" && (
        <div
          className="mt-2.5 h-1.5 rounded-full bg-[var(--border)] overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={run.requested}
          aria-valuenow={run.made}
          aria-label={t("outfits.ai.progress")}
        >
          <div className="h-full bg-[var(--foreground)] transition-[width] duration-500" style={{ width: `${Math.max(4, share * 100)}%` }} />
        </div>
      )}
      {run.error && run.status === "failed" && <p className="mt-1.5">{run.error}</p>}
      {run.log.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            aria-expanded={showLog}
            className="mt-2 text-[12px] underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            {t(showLog ? "outfits.ai.hideLog" : "outfits.ai.showLog")}
          </button>
          {showLog && (
            <ol className="mt-2 max-h-48 overflow-y-auto space-y-1 text-[12px] leading-snug opacity-90">
              {run.log.map((line, i) => (
                <li key={i} className="break-words">
                  <span className="tabular-nums opacity-60 mr-2">{new Date(line.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  {line.message}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] font-medium whitespace-nowrap transition-colors ${
    on
      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--border-strong)]"
  }`;

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** How many brands the search shows at once. */
const BRAND_MATCHES = 12;

/** The brief: how many outfits, for whom, in which styles, colours and brands, and how they are pictured. */
export function AiGenerateDialog({
  onClose,
  onStarted,
  ready,
  options,
}: {
  onClose: () => void;
  onStarted: () => void;
  ready: Ready | null;
  options: Options | null;
}) {
  const t = useT();
  const max = options?.maxOutfits ?? 10;
  const [count, setCount] = useState(4);
  const [gender, setGender] = useState<"" | "women" | "men">("");
  const [styles, setStyles] = useState<StyleKeyword[]>([]);
  const [colours, setColours] = useState<number[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [brandQuery, setBrandQuery] = useState("");
  const [imageStyle, setImageStyle] = useState<"mannequin" | "flatlay">("mannequin");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const blockers = [
    ready && !ready.database && t("outfits.ai.notReady.database"),
    ready && !ready.openai && t("outfits.ai.notReady.openai"),
    ready && !ready.replicate && t("outfits.ai.notReady.replicate"),
  ].filter((x): x is string => Boolean(x));

  const brandMatches = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    const list = options?.brands ?? [];
    return list.filter((b) => !brands.includes(b.name) && (!q || b.name.toLowerCase().includes(q))).slice(0, BRAND_MATCHES);
  }, [brandQuery, brands, options]);

  const start = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ai-outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, gender: gender || null, styles, colorGroupIds: colours, brands, imageStyle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("outfits.ai.startFailed", { status: res.status }));
        return;
      }
      onStarted();
      onClose();
    } catch {
      setError(t("outfits.ai.startFailedNetwork"));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      label={t("outfits.ai.title")}
      panelClassName="rounded-2xl w-full max-w-xl max-h-[90dvh] overflow-y-auto overscroll-contain flex flex-col"
      closeOnScrim={false}
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <h2 className="font-display text-xl font-light text-[var(--foreground)]">{t("outfits.ai.title")}</h2>
        <button onClick={onClose} aria-label={t("common.close")} title={t("common.close")} className={BTN_ICON}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed">{t("outfits.ai.intro")}</p>

        {blockers.map((b) => (
          <p key={b} role="alert" className={BANNER.warn}>{b}</p>
        ))}

        {/* How many */}
        <div>
          <label htmlFor="ai-count" className={FIELD_LABEL}>{t("outfits.ai.count")}</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1} aria-label={t("outfits.ai.fewer")} className={btn("secondary")}>−</button>
            <input
              id="ai-count"
              type="number"
              min={1}
              max={max}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(max, Math.round(Number(e.target.value) || 1))))}
              className={`${INPUT} w-20 text-center tabular-nums`}
            />
            <button type="button" onClick={() => setCount((c) => Math.min(max, c + 1))} disabled={count >= max} aria-label={t("outfits.ai.more")} className={btn("secondary")}>+</button>
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--foreground-muted)]">{t("outfits.ai.countHint", { max })}</p>
        </div>

        {/* For whom */}
        <div>
          <p className={FIELD_LABEL}>{t("outfits.ai.gender")}</p>
          <FilterChips
            label={t("outfits.ai.gender")}
            value={gender}
            options={[
              { value: "", label: t("outfits.ai.gender.any") },
              { value: "women", label: t("outfits.ai.gender.women") },
              { value: "men", label: t("outfits.ai.gender.men") },
            ]}
            onChange={(v) => setGender(v as "" | "women" | "men")}
          />
        </div>

        {/* Styles */}
        <div>
          <p className={FIELD_LABEL}>{t("outfits.ai.styles")}</p>
          <div role="group" aria-label={t("outfits.ai.styles")} className="flex flex-wrap gap-1.5">
            {STYLE_KEYWORD_LIST.map((s) => (
              <button key={s} type="button" aria-pressed={styles.includes(s)} onClick={() => setStyles((p) => toggle(p, s))} className={chip(styles.includes(s))}>
                {styleLabel(s)}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--foreground-muted)]">{t("outfits.ai.stylesHint")}</p>
        </div>

        {/* Colours */}
        <div>
          <p className={FIELD_LABEL}>{t("outfits.ai.colours")}</p>
          <div role="group" aria-label={t("outfits.ai.colours")} className="flex flex-wrap gap-1.5">
            {(options?.colorGroups ?? []).map((g) => {
              const on = colours.includes(g.id);
              const multi = g.hexCode === "#multicolor";
              return (
                <button key={g.id} type="button" aria-pressed={on} onClick={() => setColours((p) => toggle(p, g.id))} className={chip(on)}>
                  <span
                    aria-hidden="true"
                    className="w-3 h-3 rounded-full border border-[var(--border-strong)]"
                    style={{ background: multi ? "conic-gradient(#e8698a, #f5c518, #2d6a3f, #1a47a0, #7b3fa0, #e8698a)" : g.hexCode }}
                  />
                  {g.name}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--foreground-muted)]">{t("outfits.ai.coloursHint")}</p>
        </div>

        {/* Brands */}
        <div>
          <label htmlFor="ai-brand" className={FIELD_LABEL}>{t("outfits.ai.brands")}</label>
          {brands.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {brands.map((b) => (
                <button key={b} type="button" onClick={() => setBrands((p) => p.filter((x) => x !== b))} aria-label={t("outfits.ai.brandRemove", { name: b })} className={chip(true)}>
                  {b}
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              ))}
            </div>
          )}
          <input
            id="ai-brand"
            type="search"
            value={brandQuery}
            onChange={(e) => setBrandQuery(e.target.value)}
            placeholder={t("outfits.ai.brandSearch")}
            className={`${INPUT} w-full`}
          />
          <div role="group" aria-label={t("outfits.ai.brands")} className="flex flex-wrap gap-1.5 mt-2">
            {brandMatches.length === 0 ? (
              <span className="text-[12px] text-[var(--foreground-subtle)]">{t("outfits.ai.noBrands")}</span>
            ) : (
              brandMatches.map((b) => (
                <button key={b.name} type="button" onClick={() => { setBrands((p) => [...p, b.name]); setBrandQuery(""); }} className={chip(false)}>
                  {b.name}
                  <span className="text-[12px] font-normal opacity-60 tabular-nums">{b.count}</span>
                </button>
              ))
            )}
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--foreground-muted)]">{t("outfits.ai.brandsHint")}</p>
        </div>

        {/* Picture */}
        <div>
          <p className={FIELD_LABEL}>{t("outfits.ai.photo")}</p>
          <FilterChips
            label={t("outfits.ai.photo")}
            value={imageStyle}
            options={[
              { value: "mannequin", label: t("outfits.ai.photo.mannequin") },
              { value: "flatlay", label: t("outfits.ai.photo.flatlay") },
            ]}
            onChange={(v) => setImageStyle(v as "mannequin" | "flatlay")}
          />
        </div>

        {error && <p role="alert" className={BANNER.err}>{error}</p>}
      </div>

      <div className="mt-auto px-6 py-4 border-t border-[var(--border)] flex gap-3">
        <button onClick={start} disabled={starting || blockers.length > 0} className={`${btn("primary")} flex-1`}>
          {starting ? t("outfits.ai.starting") : t("outfits.ai.start", { count })}
        </button>
        <button onClick={onClose} className={btn("ghost")}>{t("common.cancel")}</button>
      </div>
    </Modal>
  );
}

/** In the review dialog: why the AI put it together, and what the checks changed in its words. */
export function AiLookNotes({ meta }: { meta: AiMeta }) {
  const t = useT();
  const changes = (meta.copy ?? []).filter((c) => c.action !== "tidied");
  return (
    <div className="mb-4 pb-4 border-b border-[var(--border)] text-[13px]">
      <p className="font-medium text-[var(--foreground)] mb-1.5 flex items-center gap-1.5">
        {SPARK}
        {t("outfits.ai.review.title")}
      </p>
      {meta.notes && <p className="text-[var(--foreground-muted)] leading-relaxed">{meta.notes}</p>}
      {meta.imageError && <p className={`${BANNER.warn} mt-2`}>{t("outfits.ai.review.noImage", { error: meta.imageError })}</p>}
      {changes.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12px] text-[var(--foreground-muted)]">
          {changes.map((c, i) => (
            <li key={i}>
              {t(c.action === "replaced" ? "outfits.ai.copy.replaced" : "outfits.ai.copy.noted", {
                field: t(c.field === "name" ? "outfits.editor.name" : "outfits.editor.description"),
                problem: c.problem,
              })}
              {c.original && <span className="block opacity-70 italic break-words">“{c.original}”</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
