"use client";

/**
 * The screen the extension talks to.
 *
 * The extension has the reach and this tab has the session, so the work is
 * split exactly there. Chrome opens the store pages — the admin address, the
 * admin cookies, the anti-bot check their browser already passed — and hands
 * back rendered markup. This tab does the one thing an extension cannot: call
 * our admin API as the logged-in admin.
 *
 * Why not let the extension call the API itself? Our session is a Clerk cookie
 * that will not travel from a chrome-extension:// origin, and the alternative —
 * shipping a long-lived API token inside an extension anyone can unpack — is a
 * key under the doormat. Nothing secret is in the extension. It knows how to
 * ask this page, and this page is only useful to whoever is already signed in
 * as an admin in it.
 *
 * The wire is `window.postMessage`, which means the extension's content script
 * and this page share an origin. Every inbound message is checked for that
 * origin and for `event.source === window` before it is read: `postMessage` is
 * shoutable by any script on the page, and a bridge that skipped the check
 * would let one do our importing for us.
 *
 * Stop is enforced on both ends. The tab tells the worker to stop *and* starts
 * refusing ingest calls, so a worker that is mid-page when the button is
 * pressed cannot land one more product after it.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CrawlItemResult } from "@/lib/server/parser/types";
import { BANNER, btn } from "../../_ui/recipes";
import { AdminPage } from "@/components/admin/AdminPage";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/DataTable";
import { useT, type Key, type T } from "@/app/goo-studio/_i18n";

// ── Wire protocol ────────────────────────────────────────────────────────────

/** Messages from the extension's content script to this page. */
const FROM_EXT = "goo-collect/ext";
/** Messages from this page back to the extension. */
const FROM_PAGE = "goo-collect/page";

interface ExtMessage {
  source: typeof FROM_EXT;
  /** Correlates a request with its reply; absent on one-way notices. */
  id?: number;
  type: "hello" | "plan" | "ingest" | "progress" | "done" | "error";
  payload?: Record<string, unknown>;
}

// ── goo-studio recipes (DESIGN_SYSTEM.md §9) ─────────────────────────────────

/** Inline label that leads a row of facts (robots.txt, Looking for ours). */
const labelCls = "text-[12px] font-medium text-[var(--foreground-muted)]";
const cardCls = "rounded-xl border border-[var(--border)] bg-[var(--surface)]";

const Spinner = () => (
  <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
);

type Phase = "idle" | "planning" | "collecting" | "done" | "stopped" | "halted";

/** The two things a run can do with a store's pages (dictionary keys). */
const MODES: { label: Key; linksOnly: boolean; says: Key }[] = [
  { label: "collect.mode.cards", linksOnly: false, says: "collect.mode.cardsSays" },
  { label: "collect.mode.links", linksOnly: true, says: "collect.mode.linksSays" },
];

/**
 * Names of things outside the admin, shown as they are: a Chrome address, a
 * folder of the repository, a button of the extension (which speaks English).
 */
const LITERAL = {
  extensionsPage: "chrome://extensions",
  folder: "extension/",
  extensionButton: "Collect this store",
  robots: "robots.txt",
  crawlDelay: "crawl-delay",
} as const;

/**
 * A message with {name} slots filled by elements, for the words inside a
 * sentence that are set apart. t() leaves a slot it has no value for as it
 * is, so the slots survive it.
 */
function fill(text: string, parts: Record<string, ReactNode>): ReactNode[] {
  return text
    .split(/\{(\w+)\}/g)
    .map((piece, i) => (i % 2 ? <Fragment key={i}>{parts[piece] ?? `{${piece}}`}</Fragment> : piece));
}

/**
 * Where the chosen mode is kept, so every collect tab runs in it: the extension
 * opens a collect tab of its own when it finds none, and a fresh tab used to
 * start in "Make cards" whatever the admin had chosen in another one.
 */
const MODE_KEY = "goo-collect-mode";

function saveMode(linksOnly: boolean) {
  try {
    window.localStorage.setItem(MODE_KEY, linksOnly ? "links" : "cards");
  } catch {
    /* storage blocked — the choice holds for this tab only */
  }
}

/**
 * The mode the extension asked for, when it asked. Its popup has a "Links
 * only" box of its own, and the box the admin ticked for this run beats the
 * mode this tab remembers. `linkOnly` is how extension 1.0.5 spelled it.
 */
function modeFromExtension(payload: Record<string, unknown>): boolean | undefined {
  if (typeof payload.linksOnly === "boolean") return payload.linksOnly;
  if (typeof payload.linkOnly === "boolean") return payload.linkOnly;
  return undefined;
}

/** What a links-only run's plan found among the store's pages. */
interface LinkSearch {
  cards: number;
  matched: number;
  unnamed: number;
  linked: number;
  other: number;
}

interface RobotsInfo {
  parsed: boolean;
  crawlDelayMs: number | null;
  blocked: number;
  sitemaps: string[];
}

export default function CollectPage() {
  const t = useT();
  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [store, setStore] = useState("");
  const [results, setResults] = useState<CrawlItemResult[]>([]);
  const [planned, setPlanned] = useState(0);
  const [delayMs, setDelayMs] = useState(0);
  const [robots, setRobots] = useState<RobotsInfo | null>(null);
  const [linkSearch, setLinkSearch] = useState<LinkSearch | null>(null);
  const [notice, setNotice] = useState("");
  /**
   * Whether this run makes cards or only adds this store to the cards we have.
   * Chosen here, or in the extension's popup when it sends a choice with the
   * run (`modeFromExtension`) — this tab makes every plan and import call, so
   * the choice travels with them either way. Mirrored in a ref for the same
   * reason as Stop below, and kept in the browser (`MODE_KEY`) so a tab the
   * extension opens runs in it too.
   */
  const [linksOnly, setLinksOnly] = useState(false);
  const linksOnlyRef = useRef(false);

  // Before the bridge's listener below, so a tab the extension has just opened
  // knows its mode by the time the first plan arrives. Another collect tab
  // changing it changes it here too: the worker may be talking to either.
  useEffect(() => {
    const apply = (value: string | null) => {
      const on = value === "links";
      linksOnlyRef.current = on;
      setLinksOnly(on);
    };
    try {
      apply(window.localStorage.getItem(MODE_KEY));
    } catch {
      /* storage blocked — the mode starts at "Make cards" and lives in this tab */
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === MODE_KEY) apply(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /**
   * Stop as a ref, not state: the message handler is registered once and would
   * otherwise close over the value it had when it was registered — which is
   * exactly the moment before the admin presses the button.
   */
  const stoppedRef = useRef(false);
  /**
   * Page titles seen in this run, sent back with each product so the server can
   * work out what this store appends to every title. Kept here because this is
   * the only place that sees more than one of the store's pages; what the
   * suffix *means* is still decided server-side.
   */
  const titlesRef = useRef<string[]>([]);

  const reply = useCallback((id: number | undefined, ok: boolean, data: unknown) => {
    if (typeof id !== "number") return;
    window.postMessage(
      { source: FROM_PAGE, id, ok, ...(ok ? { data } : { error: data }) },
      window.location.origin,
    );
  }, []);

  /** A one-way instruction to the worker (stop), with no reply expected. */
  const command = useCallback((type: string) => {
    window.postMessage({ source: FROM_PAGE, type }, window.location.origin);
  }, []);

  /**
   * Forget the previous run: its Stop, its counters and the store's titles.
   *
   * Called by Clear and by every `hello` — the worker sends one at the start of
   * each run, so a Stop pressed on the last run cannot refuse the next one. Not
   * on `plan`: that arrives on every round of the same run.
   */
  const reset = useCallback(() => {
    stoppedRef.current = false;
    titlesRef.current = [];
    setResults([]);
    setPlanned(0);
    setDelayMs(0);
    setStore("");
    setNotice("");
    setRobots(null);
    setLinkSearch(null);
    setPhase("idle");
  }, []);

  const callApi = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/parser/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error ?? t("collect.requestFailed", { status: String(res.status) }));
    }
    return data as Record<string, unknown>;
  }, [t]);

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      // Only this page, in this tab, on this origin. `postMessage` is open to
      // anything running here, and the bridge is a privileged one.
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;

      const msg = event.data as ExtMessage | null;
      if (!msg || msg.source !== FROM_EXT || typeof msg.type !== "string") return;

      const payload = msg.payload ?? {};

      switch (msg.type) {
        case "hello": {
          reset();
          setConnected(true);
          reply(msg.id, true, { ready: true });
          return;
        }

        case "plan": {
          if (stoppedRef.current) return reply(msg.id, false, t("collect.stoppedByAdmin"));
          setConnected(true);
          setPhase("planning");
          setNotice("");
          const target = typeof payload.url === "string" ? payload.url : "";
          setStore(target);
          try {
            const asked = modeFromExtension(payload);
            if (asked !== undefined && asked !== linksOnlyRef.current) {
              linksOnlyRef.current = asked;
              setLinksOnly(asked);
              saveMode(asked);
            }
            const data = await callApi({ action: "plan", ...payload, linksOnly: linksOnlyRef.current });
            const urls = Array.isArray(data.urls) ? (data.urls as string[]) : [];
            setPlanned((n) => n + urls.length);
            setDelayMs(Number(data.delayMs) || 0);
            setRobots((data.robots as RobotsInfo) ?? null);
            setLinkSearch((data.links as LinkSearch) ?? null);
            if (typeof data.linksNote === "string") setNotice(t("collect.linksNote", { note: data.linksNote }));
            if (urls.length) setPhase("collecting");
            reply(msg.id, true, data);
          } catch (err) {
            const message = err instanceof Error ? err.message : t("collect.planFailed");
            setNotice(message);
            setPhase("idle");
            reply(msg.id, false, message);
          }
          return;
        }

        case "ingest": {
          // Refusing here is what makes Stop immediate: a worker already
          // mid-page cannot land one more product after the button.
          if (stoppedRef.current) return reply(msg.id, false, t("collect.stoppedByAdmin"));
          setConnected(true);
          setPhase("collecting");
          try {
            const pageTitle = typeof payload.pageTitle === "string" ? payload.pageTitle : "";
            if (pageTitle && !titlesRef.current.includes(pageTitle)) {
              titlesRef.current = [...titlesRef.current, pageTitle].slice(-12);
            }
            const data = await callApi({
              action: "ingest",
              ...payload,
              titles: titlesRef.current,
              linksOnly: modeFromExtension(payload) ?? linksOnlyRef.current,
            });
            const result = data.result as CrawlItemResult | undefined;
            if (result) setResults((prev) => [...prev, result]);
            reply(msg.id, true, data);
          } catch (err) {
            const message = err instanceof Error ? err.message : t("collect.ingestFailed");
            const url = typeof payload.url === "string" ? payload.url : "";
            setResults((prev) => [...prev, { url, status: "failed", reason: message }]);
            reply(msg.id, false, message);
          }
          return;
        }

        case "progress": {
          setConnected(true);
          if (typeof payload.planned === "number") setPlanned(payload.planned);
          if (typeof payload.delayMs === "number") setDelayMs(payload.delayMs);
          if (typeof payload.store === "string" && payload.store) setStore(payload.store);
          return;
        }

        case "error": {
          // The worker stopping itself — two refusals in a row, most often.
          setNotice(typeof payload.message === "string" ? payload.message : t("collect.runStopped"));
          setPhase("halted");
          return;
        }

        case "done": {
          setPhase((p) => (p === "stopped" ? "stopped" : "done"));
          return;
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [callApi, reply, reset, t]);

  function chooseMode(value: boolean) {
    linksOnlyRef.current = value;
    setLinksOnly(value);
    saveMode(value);
  }

  function stop() {
    stoppedRef.current = true;
    setPhase("stopped");
    command("stop");
  }

  const done = results.length;
  const imported = results.filter((r) => r.status === "imported").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const failed = results.filter((r) => r.status === "failed" || r.status === "skipped").length;
  const photos = results.reduce((n, r) => n + (r.imagesMirrored ?? 0), 0);
  // Saved without columns the database lacks — the same note on every row, so said once.
  const warnings = [...new Set(results.flatMap((r) => (r.warning ? [r.warning] : [])))];
  const running = phase === "planning" || phase === "collecting";
  const pct = planned ? Math.min(100, Math.round((done / planned) * 100)) : 0;

  // The emphasis a step of the install puts on what to look for on screen.
  const strong = (text: string) => <span className="text-[var(--foreground)]">{text}</span>;

  return (
    <AdminPage layout="form">
      <PageHeader title={t("collect.title")} subtitle={t("collect.subtitle")} />

      <div className="space-y-5">
        {/* Connection */}
        <div className={`${cardCls} px-5 py-4 flex items-center gap-3 flex-wrap`}>
          <span
            aria-hidden="true"
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              connected ? "bg-[var(--ok)]" : "bg-[var(--foreground-subtle)]"
            }`}
          />
          <p className="text-[13px] font-medium text-[var(--foreground)]">
            {connected ? t("collect.connected") : t("collect.waiting")}
          </p>
          {store && (
            <span className="text-[11px] text-[var(--foreground-muted)] truncate max-w-full md:max-w-[420px]">
              {store.replace(/^https?:\/\/(www\.)?/, "")}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {running ? (
              <button onClick={stop} className={btn("secondary")} aria-label={t("collect.stopRun")}>
                {t("parser.stop")}
              </button>
            ) : (
              results.length > 0 && (
                <button onClick={reset} className={btn("ghost")}>
                  {t("parser.clear")}
                </button>
              )
            )}
          </div>
        </div>

        {/* What the run does with each page — set before starting it */}
        <div className={`${cardCls} px-5 py-4 flex items-center gap-4 flex-wrap`}>
          <div
            role="group"
            aria-label={t("collect.modes")}
            className="flex gap-0 bg-[var(--background)] rounded-full p-1 border border-[var(--border)] w-fit"
          >
            {MODES.map((m) => {
              const active = linksOnly === m.linksOnly;
              return (
                <button
                  key={m.label}
                  type="button"
                  aria-pressed={active}
                  disabled={running}
                  onClick={() => chooseMode(m.linksOnly)}
                  className={`shrink-0 px-5 py-2 text-[13px] font-medium rounded-full transition-colors duration-200 disabled:opacity-40 ${
                    active
                      ? "bg-[var(--foreground)] text-[var(--surface)]"
                      : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {t(m.label)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--foreground-muted)] flex-1 min-w-[220px]">
            {t(MODES.find((m) => m.linksOnly === linksOnly)?.says ?? "collect.mode.cardsSays")}
            {running && ` ${t("collect.mode.betweenRuns")}`}
          </p>
        </div>

        {!connected && (
          <div className={`${cardCls} px-5 py-4 space-y-2`}>
            <h2 className="text-[13px] font-medium text-[var(--foreground)]">{t("collect.install.title")}</h2>
            <ol className="text-[12px] text-[var(--foreground-muted)] space-y-1 list-decimal pl-4">
              <li>{fill(t("collect.install.step1"), { page: strong(LITERAL.extensionsPage) })}</li>
              <li>
                {fill(t("collect.install.step2"), {
                  button: strong(t("collect.install.loadUnpacked")),
                  folder: strong(LITERAL.folder),
                })}
              </li>
              <li>{fill(t("collect.install.step3"), { button: strong(LITERAL.extensionButton) })}</li>
              <li>{t("collect.install.step4")}</li>
            </ol>
          </div>
        )}

        {notice && (
          <div className={BANNER.warn}>
            {notice}
          </div>
        )}

        {robots && (
          <div className={`${cardCls} px-5 py-3 flex items-center gap-4 flex-wrap text-[11px]`}>
            <span className={labelCls}>{LITERAL.robots}</span>
            <span className="text-[var(--foreground-muted)]">
              {robots.parsed ? t("collect.robots.read") : t("collect.robots.none")}
            </span>
            <span className="text-[var(--foreground-muted)]">
              {LITERAL.crawlDelay}{" "}
              <span className="text-[var(--foreground)] tabular-nums">
                {robots.crawlDelayMs ? seconds(robots.crawlDelayMs, t) : t("collect.robots.notSet")}
              </span>
            </span>
            <span className="text-[var(--foreground-muted)]">
              {t("collect.robots.pacing")}{" "}
              <span className="text-[var(--foreground)] tabular-nums">{seconds(delayMs, t)}</span>
            </span>
            {robots.blocked > 0 && (
              <span className="text-[var(--warn)] tabular-nums">{t("collect.robots.blocked", { count: robots.blocked })}</span>
            )}
          </div>
        )}

        {linkSearch && (
          <div className={`${cardCls} px-5 py-3 flex items-center gap-4 flex-wrap text-[11px]`}>
            <span className={labelCls}>{t("collect.links.label")}</span>
            <span className="text-[var(--foreground-muted)] tabular-nums">
              {t("collect.links.matched", { count: linkSearch.matched, cards: linkSearch.cards })}
            </span>
            {linkSearch.unnamed > 0 && (
              <span className="text-[var(--foreground-muted)] tabular-nums">
                {t("collect.links.unnamed", { count: linkSearch.unnamed })}
              </span>
            )}
            {linkSearch.linked > 0 && (
              <span className="text-[var(--foreground-muted)] tabular-nums">
                {t("collect.links.linked", { count: linkSearch.linked })}
              </span>
            )}
            {linkSearch.other > 0 && (
              <span className="text-[var(--foreground-subtle)] tabular-nums">
                {t("collect.links.other", { count: linkSearch.other })}
              </span>
            )}
          </div>
        )}

        {/* Progress + outcomes */}
        {(running || results.length > 0) && (
          <div className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3.5 border-b border-[var(--border)] space-y-2.5">
              <div className="flex items-center gap-4 flex-wrap">
                <p className="text-[13px] font-medium text-[var(--foreground)] inline-flex items-center gap-1.5">
                  {running && <Spinner />}
                  {phase === "planning" && t("collect.reading")}
                  {phase === "collecting" && t("parser.run.collecting", { done, total: planned || "…" })}
                  {phase === "done" && t("parser.run.finished")}
                  {phase === "stopped" && t("parser.run.stopped")}
                  {phase === "halted" && t("collect.halted")}
                  {phase === "idle" && t("collect.ready")}
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
                  <span className="text-[var(--ok)]">{t("parser.count.new", { count: imported })}</span>
                  <span className="text-[var(--foreground-muted)]">{t("parser.count.updated", { count: updated })}</span>
                  {failed > 0 && <span className="text-[var(--warn)]">{t("parser.count.skipped", { count: failed })}</span>}
                  {!running && results.length > 0 && (
                    <a
                      href="/goo-studio/products"
                      className="underline hover:no-underline text-[var(--foreground)]"
                    >
                      {t("parser.viewProducts")}
                    </a>
                  )}
                </div>
              </div>
              <div className="h-1 rounded-full bg-[var(--fg-overlay-08)] overflow-hidden">
                <div
                  className="h-full bg-[var(--foreground)] transition-[width] duration-300"
                  style={{ width: `${phase === "planning" ? 4 : pct}%` }}
                />
              </div>
              {photos > 0 && (
                <p className="text-[12px] text-[var(--foreground-subtle)]">
                  {t("parser.photosCopied", { count: photos })}
                </p>
              )}
              {warnings.map((w) => (
                <p key={w} className={BANNER.warn}>
                  {w}
                </p>
              ))}
            </div>

            {results.length > 0 && (
              <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
                {results.map((r, i) => (
                  <div
                    key={`${r.url}-${i}`}
                    className="px-5 py-2.5 flex items-center gap-3 text-[11px]"
                  >
                    <StatusBadge status={r.status} />
                    <span className="text-[var(--foreground)] truncate flex-1 min-w-0">
                      {r.name || r.url.replace(/^https?:\/\/(www\.)?/, "")}
                    </span>
                    {r.reason && (
                      <span
                        className="text-[11px] text-[var(--foreground-muted)] truncate max-w-[40%] md:max-w-[480px] flex-shrink-0"
                        title={r.reason}
                      >
                        {r.reason}
                      </span>
                    )}
                    {!r.reason && detailLine(r, t) && (
                      <span
                        className="text-[11px] text-[var(--foreground-muted)] truncate max-w-[40%] md:max-w-[480px] flex-shrink-0"
                        title={detailLine(r, t)}
                      >
                        {detailLine(r, t)}
                      </span>
                    )}
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t("collect.openPage")}
                      className="inline-flex items-center justify-center min-w-10 min-h-10 md:min-w-0 md:min-h-0 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] flex-shrink-0"
                    >
                      ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!running && results.length === 0 && connected && <EmptyState text={t("collect.empty")} />}
      </div>
    </AdminPage>
  );
}

/** Milliseconds as seconds with one decimal at most, in the admin's language: "2.5s" / "2,5 с". */
function seconds(ms: number, t: T): string {
  return t("collect.robots.seconds", { s: Math.round(ms / 100) / 10 });
}

/**
 * What a finished page has to say for itself beyond "imported".
 *
 * Two questions the admin would otherwise have to open the catalog to answer:
 * how many photos came across, and what happened to the price. The second one
 * matters most on a store that does not price in dollars — the catalog stores
 * dollars, so the row says which rate turned ₴4,000 into a number, rather than
 * leaving the admin to wonder whether it did. A brand read off the product name
 * is said too, since it replaced whatever the page gave.
 */
function detailLine(r: CrawlItemResult, t: T): string {
  const parts: string[] = [];
  if (r.images) parts.push(t("collect.row.photos", { count: r.images }));
  if (r.priceNote) parts.push(r.priceNote);
  if (r.brandNote) parts.push(r.brandNote);
  if (r.colorNote) parts.push(r.colorNote);
  if (r.linkNote) parts.push(r.linkNote);
  if (r.genderNote) parts.push(r.genderNote);
  if (r.styleNote) parts.push(r.styleNote);
  if (r.variantsLinked) parts.push(t("parser.note.grouped", { count: r.variantsLinked }));
  // A merge is the interesting outcome on this row: the page did not create a
  // product, it added a place to buy one we already had.
  if (r.merged) {
    const filled = (r.mergedFields ?? []).filter((f) => f !== "retailer");
    // Said, because a name match is a judgement where a code match is a fact,
    // and the admin is the one who can undo a wrong one.
    const byName = r.mergedBy === "name";
    parts.push(
      filled.length
        ? t(byName ? "collect.row.mergedByNameFilling" : "collect.row.mergedFilling", { fields: filled.join(", ") })
        : t(byName ? "collect.row.mergedByName" : "parser.note.merged"),
    );
  }
  return parts.join(" · ");
}

const STATUS_BADGE: Record<CrawlItemResult["status"], { tone: BadgeTone; label: Key }> = {
  imported: { tone: "ok", label: "parser.status.imported" },
  updated: { tone: "neutral", label: "parser.status.updated" },
  skipped: { tone: "warn", label: "parser.status.skipped" },
  failed: { tone: "err", label: "parser.status.failed" },
};

/** A collected page's outcome. Its column keeps one width, so the names after it line up. */
function StatusBadge({ status }: { status: CrawlItemResult["status"] }) {
  const t = useT();
  const { tone, label } = STATUS_BADGE[status];
  return (
    <span className="w-[72px] flex-shrink-0">
      <Badge tone={tone}>{t(label)}</Badge>
    </span>
  );
}
