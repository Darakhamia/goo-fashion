"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type {
  ParserFetchSettings,
  ParserSiteConfig,
  ParserAiSettings,
  ParsedProduct,
  FetchProvider,
  ParserRuleField,
  CrawlItemResult,
} from "@/lib/server/parser/types";
import type { Category, Gender } from "@/lib/types";
import { bookmarkletHref, readPastedPage } from "@/lib/parser-bookmarklet";
import { pastedUrl } from "@/lib/url";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { PageHeader, PLUS } from "@/components/admin/PageHeader";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { FormPanel, FormSection } from "@/components/admin/FormSection";
import { SaveBar } from "@/components/admin/SaveBar";
import { BANNER, btn, BTN_ICON, FIELD_LABEL, INPUT, SELECT } from "../_ui/recipes";
import { AdminPage } from "@/components/admin/AdminPage";
import { useFormat, useT, type Key, type T } from "@/app/goo-studio/_i18n";

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  "outerwear", "blazers", "tops", "shirts", "knitwear", "bottoms", "jeans",
  "shorts", "skirts", "dresses", "jumpsuits", "swimwear", "footwear", "bags", "accessories",
];
const GENDERS: Gender[] = ["women", "men", "unisex"];
/** Dictionary keys, not text: the names and hints read in the admin's language. */
const PROVIDERS: { value: FetchProvider; label: Key; hint: Key }[] = [
  { value: "direct", label: "parser.provider.direct", hint: "parser.provider.direct.hint" },
  { value: "scrapingbee", label: "parser.provider.scrapingbee", hint: "parser.provider.scrapingbee.hint" },
  { value: "scraperapi", label: "parser.provider.scraperapi", hint: "parser.provider.scraperapi.hint" },
  { value: "zenrows", label: "parser.provider.zenrows", hint: "parser.provider.zenrows.hint" },
  { value: "custom", label: "parser.provider.custom", hint: "parser.provider.custom.hint" },
];
/**
 * Example addresses and templates in the fields, and the name of the key's
 * environment variable: data the admin copies as it is, the same in every
 * language, so it stays out of the dictionary.
 */
const EXAMPLE = {
  storeUrl: "https://www.balenciaga.com/en-us/men/ready-to-wear",
  productUrl: "https://www.farfetch.com/shopping/men/...",
  anyProductUrl: "https://www.store.com/product/…",
  domain: "example.com",
  endpoint: "https://my-scraper.fly.dev/fetch?token={key}&url={url}&render={render}&impersonate={impersonate}",
  keyEnv: "PARSER_FETCH_API_KEY",
} as const;
const IMPERSONATE = ["chrome", "safari", "firefox", "edge"];
const RULE_FIELDS: ParserRuleField[] = [
  "name", "brand", "price", "currency", "image", "sizes", "color", "material", "description",
];

interface ConfigState {
  fetchSettings: ParserFetchSettings;
  key: { configured: boolean; source: "env" | "database" | null; masked: string };
  siteConfigs: ParserSiteConfig[];
  aiSettings: ParserAiSettings;
  openai: { configured: boolean };
}

type Diagnostics = {
  provider: string;
  status: number;
  htmlLength: number;
  finalUrl: string;
  matchedConfig: { id: string; name: string; domain: string } | null;
  strategies?: string[];
  aiFields?: string[];
  aiError?: string;
};

interface ParseResponse {
  ok: boolean;
  products?: ParsedProduct[];
  links?: string[];
  isListing?: boolean;
  error?: string;
  hint?: string;
  diagnostics?: Diagnostics;
}

type Tab = "collect" | "parse" | "recipes" | "fetch";

/** What one import did, as `/api/admin/parser/import` reports it. */
interface ImportOutcome {
  productId: string | null;
  updated: boolean;
  /** The card this page joined as another store, when it did not make one. */
  mergedInto?: string;
  mergedBy?: "code" | "name";
  /** Colors of the same piece it was grouped with. */
  variantsLinked?: number;
  /** Why a new card was made rather than a store added. */
  linkNote?: string;
  priceNote?: string;
  warning?: string;
}

/** The import's outcome in a few words. */
function importHeadline(o: ImportOutcome, t: T): string {
  if (o.mergedInto) return t("parser.import.merged");
  return o.updated ? t("parser.import.updated") : t("parser.import.created");
}

/** What else the admin should know: colors grouped, why a new card, the price. */
function importDetails(o: ImportOutcome, t: T): string {
  const colors = o.variantsLinked ? t("parser.import.groupedOther", { count: o.variantsLinked }) : "";
  const how = o.mergedInto && o.mergedBy === "name" ? t("parser.import.byName") : "";
  return [how, colors, o.linkNote ?? "", o.priceNote ?? ""].filter(Boolean).join(" · ");
}

/** A collected page's note beyond its status: the card it joined, the colors it was grouped with. */
function crawlRowNote(r: CrawlItemResult, t: T): string {
  const joined = r.linkNote ?? (r.merged ? t("parser.note.merged") : "");
  const colors = r.variantsLinked ? t("parser.note.grouped", { count: r.variantsLinked }) : "";
  return [joined, colors].filter(Boolean).join(" · ");
}

/**
 * A message with {name} slots filled by elements, for the words inside a
 * sentence that are set apart (a provider name, an environment variable).
 * t() leaves a slot it has no value for as it is, so the slots survive it.
 */
function fill(text: string, parts: Record<string, ReactNode>): ReactNode[] {
  return text
    .split(/\{(\w+)\}/g)
    .map((piece, i) => (i % 2 ? <Fragment key={i}>{parts[piece] ?? `{${piece}}`}</Fragment> : piece));
}

// ── Tiny styled primitives (goo-studio recipes, DESIGN_SYSTEM.md §9) ─────────

/** The admin field without its size and fill, for the one variant the recipes lack. */
const fieldBase =
  "w-full rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";
const inputCls = `${INPUT} w-full`;
/** Regexes, endpoint templates, keys. */
const monoInputCls = `${fieldBase} font-mono text-[11px] bg-transparent`;
const selectCls = `${SELECT} w-full`;
/** Where the extension hands its pages to; install steps live there too. */
const EXTENSION_PAGE = "/goo-studio/parser/collect";
const Spinner = () => (
  <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
);

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ParserPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("collect");
  const [config, setConfig] = useState<ConfigState | null>(null);
  /** A dictionary key, so the message follows a language switch. */
  const [loadError, setLoadError] = useState<Key | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  /**
   * A URL handed from Collect to Parse URL when the store refused us.
   *
   * The way past a refusal is the admin's own browser, and it lives in the
   * other tab — so the screen carries the address across and opens the panel,
   * instead of telling someone who has just been blocked to go and find it.
   */
  const [handoff, setHandoff] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/parser/config");
        if (!active) return;
        if (res.status === 401) { setUnauthorized(true); return; }
        if (!res.ok) { setLoadError("parser.loadFailed"); return; }
        setConfig(await res.json());
      } catch {
        if (active) setLoadError("parser.loadNetwork");
      }
    })();
    return () => { active = false; };
  }, []);

  if (unauthorized) {
    return (
      <AdminPage layout="form">
        <Header />
        <div className="rounded-xl border border-[var(--border)] px-5 py-4">
          <p className="text-[12px] text-[var(--foreground-muted)] leading-relaxed">
            {t("parser.denied")}
          </p>
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage layout="form">
      <Header />

      {/* Tabs */}
      {/* On a phone the four tabs take their short names and fit the width
          (GS4-11); the strip still scrolls rather than widen the page if a
          screen is narrower yet. The shared Tabs has no short names, so the
          strip stays its own. */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--border)] overflow-x-auto overflow-y-hidden no-scrollbar">
        {(
          [
            ["collect", t("parser.tab.collect"), t("parser.tab.collectShort")],
            ["parse", t("parser.tab.parse"), t("parser.tab.parseShort")],
            ["recipes", t("parser.tab.recipes"), t("parser.tab.recipesShort")],
            ["fetch", t("parser.tab.fetch"), t("parser.tab.fetchShort")],
          ] as [Tab, string, string][]
        ).map(([key, label, short]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setHandoff(null); }}
            className={`shrink-0 whitespace-nowrap px-3 md:px-4 py-2.5 text-[13px] font-medium transition-colors -mb-px border-b-2 ${
              tab === key
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className="md:hidden">{short}</span>
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </div>

      {loadError && <div className={`${BANNER.err} mb-4`}>{t(loadError)}</div>}

      {tab === "collect" && (
        <CollectTab
          config={config}
          onPastePage={(target) => { setHandoff(target); setTab("parse"); }}
        />
      )}
      {tab === "parse" && (
        <ParseTab config={config} initialUrl={handoff ?? ""} openPaste={!!handoff} />
      )}
      {/* The two settings tabs stay mounted while hidden, so an unsaved draft
          survives a look at another tab instead of vanishing with it. */}
      {config && (
        <div hidden={tab !== "recipes"}>
          <RecipesTab config={config} onSaved={(c) => setConfig((s) => (s ? { ...s, siteConfigs: c } : s))} />
        </div>
      )}
      {config && (
        <div hidden={tab !== "fetch"}>
          <FetchTab config={config} onSaved={(next) => setConfig(next)} />
        </div>
      )}
    </AdminPage>
  );
}

/** The page head: what the parser is for, and how it reads a page behind the "?". */
function Header() {
  const t = useT();
  const help = useHelp("parser");
  return (
    <>
      <PageHeader
        title={t("parser.title")}
        titleExtra={<HelpButton help={help} label={t("parser.help.label")} />}
        subtitle={t("parser.subtitle")}
      />
      {help.open && (
        <div className="mb-6">
          <HelpPanel help={help}>
            <p>{t("parser.help.text")}</p>
          </HelpPanel>
        </div>
      )}
    </>
  );
}

// ── Collect tab (bulk crawl) ─────────────────────────────────────────────────

/** URLs sent per batch request — must match MAX_BATCH on the crawl route. */
const BATCH_SIZE = 5;

type CrawlPhase = "idle" | "discovering" | "importing" | "done" | "stopped";

/** Statuses that mean the store refused us rather than that the URL is wrong. */
const REFUSAL_STATUSES = new Set([401, 403, 429, 503]);

/** `fetch.ts` reports a refusal in exactly this shape. */
const REFUSAL_ERROR = /^Upstream responded (?:401|403|429|503)\b/;

/**
 * Did the store refuse us, rather than the URL being wrong or the request
 * dying on the way?
 *
 * The status decides, with the error text as a second reading. The offer this
 * gates is the entire answer to a refusal, so it must not hinge on one field
 * of one response — a deployment mid-flight, or a client older than the route
 * answering it, is enough to lose the field and leave the admin looking at a
 * wall with no door in it.
 */
function isRefusal(data: { status?: number; error?: string }): boolean {
  if (typeof data.status === "number" && REFUSAL_STATUSES.has(data.status)) return true;
  return REFUSAL_ERROR.test(data.error ?? "");
}

function CollectTab({
  config,
  onPastePage,
}: {
  config: ConfigState | null;
  onPastePage: (url: string) => void;
}) {
  const t = useT();
  const [url, setUrl] = useState("");
  // Defaults that collect a small store in one press rather than its first
  // screenful. The ceiling is the catalog-sized one the route now allows;
  // the default stays modest because a run on a store with no structured data
  // spends a model call per product.
  const [limit, setLimit] = useState(100);
  const [maxPages, setMaxPages] = useState(3);
  // null = follow the saved default; a boolean = the admin overrode it for this run.
  const [useAiOverride, setUseAiOverride] = useState<boolean | null>(null);
  const [mirrorOverride, setMirrorOverride] = useState<boolean | null>(null);
  // A second store's pages add their link and price to the cards we have, and
  // create nothing: what the admin wants when the store is only another place
  // to buy.
  const [linksOnly, setLinksOnly] = useState(false);

  const [phase, setPhase] = useState<CrawlPhase>("idle");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  /** The refused URL, kept so the paste route can be offered on the spot. */
  const [refused, setRefused] = useState("");
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [results, setResults] = useState<CrawlItemResult[]>([]);
  const stopRef = useRef(false);

  const useAi = useAiOverride ?? config?.aiSettings.enabled ?? true;
  const mirrorImages = mirrorOverride ?? config?.aiSettings.downloadImages ?? true;

  const running = phase === "discovering" || phase === "importing";
  const done = results.length;
  const imported = results.filter((r) => r.status === "imported").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const failed = results.filter((r) => r.status === "failed" || r.status === "skipped").length;
  const aiUsed = results.filter((r) => r.usedAi).length;
  const photos = results.reduce((n, r) => n + (r.imagesMirrored ?? 0), 0);
  // Saved without columns the database lacks — the same note on every row, so said once.
  const warnings = [...new Set(results.flatMap((r) => (r.warning ? [r.warning] : [])))];

  async function start() {
    const target = url.trim();
    if (!target) return;

    stopRef.current = false;
    setError(""); setHint(""); setRefused(""); setResults([]); setDiscovered([]);
    setPhase("discovering");

    let urls: string[] = [];
    try {
      const res = await fetch("/api/admin/parser/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover", url: target, limit, maxPages, linksOnly }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? t("parser.crawl.readFailed"));
        setHint(data.hint ?? "");
        // A refusal is the one failure with a free way around it, so every
        // refusal gets the offer — not only the addresses `looksLikeProductPath`
        // recognizes. A store whose URL shape we have never seen is exactly the
        // one where that test says "listing", and pasting its page is still the
        // way in. What the paste route cannot do — collect a catalog — the
        // hint above says in the same breath.
        if (isRefusal(data)) setRefused(target);
        setPhase("idle");
        return;
      }
      urls = data.urls ?? [];
      setDiscovered(urls);
      if (data.hint) setHint(data.hint);
      if (!urls.length) { setPhase("idle"); return; }
    } catch {
      setError(t("parser.crawl.readNetwork"));
      setPhase("idle");
      return;
    }

    setPhase("importing");
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      if (stopRef.current) { setPhase("stopped"); return; }
      const slice = urls.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch("/api/admin/parser/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "batch", urls: slice, useAi, mirrorImages, linksOnly }),
        });
        const data = await res.json();
        if (data?.results) setResults((prev) => [...prev, ...(data.results as CrawlItemResult[])]);
        else {
          setResults((prev) => [
            ...prev,
            ...slice.map((u): CrawlItemResult => ({ url: u, status: "failed", reason: data?.error ?? t("parser.crawl.batchFailed") })),
          ]);
        }
      } catch {
        setResults((prev) => [
          ...prev,
          ...slice.map((u): CrawlItemResult => ({ url: u, status: "failed", reason: t("common.networkError") })),
        ]);
      }
    }
    setPhase(stopRef.current ? "stopped" : "done");
  }

  const pct = discovered.length ? Math.round((done / discovered.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[13px] font-medium text-[var(--foreground)] mb-1.5">{t("parser.crawl.urlLabel")}</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !running && start()}
              placeholder={EXAMPLE.storeUrl}
              spellCheck={false}
              disabled={running}
              className={inputCls}
            />
          </div>
          {running ? (
            <button onClick={() => { stopRef.current = true; }} className={btn("secondary")}>{t("parser.stop")}</button>
          ) : (
            <button onClick={start} disabled={!url.trim()} className={btn("primary")}>{t("parser.crawl.collect")}</button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label={t("parser.crawl.maxProducts")}>
            <input
              type="number" min={1} max={2000} value={limit} disabled={running}
              onChange={(e) => setLimit(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))}
              className={inputCls}
            />
          </Field>
          <Field label={t("parser.crawl.listingPages")}>
            <input
              type="number" min={1} max={20} value={maxPages} disabled={running}
              onChange={(e) => setMaxPages(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className={inputCls}
            />
          </Field>
          <div className="col-span-2 flex flex-col justify-end gap-2 pb-0.5">
            <Toggle
              on={useAi && !!config?.openai.configured}
              disabled={running || !config?.openai.configured}
              onChange={setUseAiOverride}
              label={config?.openai.configured ? t("parser.crawl.useAi") : t("parser.crawl.aiUnavailable")}
            />
            <Toggle
              on={mirrorImages && !linksOnly}
              disabled={running || linksOnly}
              onChange={setMirrorOverride}
              label={t("parser.crawl.mirror")}
            />
            <Toggle
              on={linksOnly}
              disabled={running}
              onChange={setLinksOnly}
              label={t("parser.crawl.linksOnly")}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] px-4 py-3 flex items-center gap-3 flex-wrap">
          <p className="flex-1 min-w-[220px] text-[12px] text-[var(--foreground)] leading-relaxed">
            {t("parser.crawl.extTitle")}
            <span className="block text-[11px] text-[var(--foreground-muted)]">
              {t("parser.crawl.extText")}
            </span>
          </p>
          <Link href={EXTENSION_PAGE} className={btn("secondary")}>{t("parser.extension")}</Link>
        </div>

        <p className="text-[12px] text-[var(--foreground-subtle)] leading-relaxed">
          {fill(t("parser.crawl.note", { tab: t("parser.tab.fetch") }), {
            provider: <span className="text-[var(--foreground-muted)]">{config?.fetchSettings.provider ?? "direct"}</span>,
          })}
        </p>
      </div>

      {error && (
        <div className={`${BANNER.err} space-y-1`}>
          <p>{error}</p>
          {hint && <p className="text-[var(--foreground-muted)] leading-relaxed">{hint}</p>}
          {refused && (
            <div className="pt-1.5 flex items-center gap-2 flex-wrap">
              <Link href={EXTENSION_PAGE} className={btn("secondary")}>
                {t("parser.extension")}
              </Link>
              <button onClick={() => onPastePage(refused)} className={btn("secondary")}>
                {t("parser.crawl.pasteInstead")}
              </button>
            </div>
          )}
        </div>
      )}
      {!error && hint && (
        <div className={BANNER.warn}>{hint}</div>
      )}

      {/* Progress */}
      {(running || results.length > 0) && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--border)] space-y-2.5">
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-[13px] font-medium text-[var(--foreground)]">
                {phase === "discovering" && t("parser.crawl.reading")}
                {phase === "importing" && t("parser.run.collecting", { done, total: discovered.length })}
                {phase === "done" && t("parser.run.finished")}
                {phase === "stopped" && t("parser.run.stopped")}
              </p>
              <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
                <span className="text-[var(--ok)]">{t("parser.count.new", { count: imported })}</span>
                <span className="text-[var(--foreground-muted)]">{t("parser.count.updated", { count: updated })}</span>
                {failed > 0 && <span className="text-[var(--warn)]">{t("parser.count.skipped", { count: failed })}</span>}
                {(phase === "done" || phase === "stopped") && (
                  <a href="/goo-studio/products" className="underline hover:no-underline text-[var(--foreground)]">{t("parser.viewProducts")}</a>
                )}
              </div>
            </div>
            <div className="h-1 rounded-full bg-[var(--fg-overlay-08)] overflow-hidden">
              <div
                className="h-full bg-[var(--foreground)] transition-[width] duration-300"
                style={{ width: `${phase === "discovering" ? 4 : pct}%` }}
              />
            </div>
            {(photos > 0 || aiUsed > 0) && (
              <p className="text-[12px] text-[var(--foreground-subtle)]">
                {photos > 0 && t("parser.photosCopied", { count: photos })}
                {photos > 0 && aiUsed > 0 && " · "}
                {aiUsed > 0 && t("parser.crawl.neededAi", { count: aiUsed })}
              </p>
            )}
            {warnings.map((w) => <p key={w} className={BANNER.warn}>{w}</p>)}
          </div>

          {results.length > 0 && (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
              {results.map((r, i) => (
                <div key={`${r.url}-${i}`} className="px-5 py-2.5 flex items-center gap-3 text-[11px]">
                  <StatusBadge status={r.status} />
                  <span className="text-[var(--foreground)] truncate flex-1 min-w-0">
                    {r.name || r.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </span>
                  {r.usedAi && (
                    <span className="text-[11px] font-medium text-[var(--foreground-subtle)] flex-shrink-0">{t("parser.crawl.ai")}</span>
                  )}
                  {r.reason && (
                    <span className="text-[11px] text-[var(--foreground-muted)] truncate max-w-[40%] md:max-w-[220px] flex-shrink-0" title={r.reason}>
                      {r.reason}
                    </span>
                  )}
                  {!r.reason && crawlRowNote(r, t) && (
                    <span
                      className="text-[11px] text-[var(--foreground-muted)] truncate max-w-[260px] flex-shrink-0"
                      title={crawlRowNote(r, t)}
                    >
                      {crawlRowNote(r, t)}
                    </span>
                  )}
                  <a
                    href={r.url} target="_blank" rel="noreferrer"
                    aria-label={t("parser.crawl.openPage")}
                    className="inline-flex items-center justify-center min-w-10 min-h-10 md:min-w-0 md:min-h-0 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] flex-shrink-0"
                  >↗</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
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

/** The one switch on this screen, drawn as the admin's switch in Users. */
function Toggle({
  on, onChange, label, ariaLabel, disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  /** Visible caption. Without one, `ariaLabel` names the switch. */
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${on ? "bg-[var(--foreground)]" : "bg-[var(--border-strong)]"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface)] transition-[left] ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
  if (!label) return track;
  return (
    <label className={`flex items-center gap-2.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      {track}
      <span className="text-[11px] text-[var(--foreground)] leading-tight">{label}</span>
    </label>
  );
}

// ── Parse tab ────────────────────────────────────────────────────────────────

function ParseTab({
  config,
  initialUrl = "",
  openPaste = false,
}: {
  config: ConfigState | null;
  /** Address carried over from a refusal in Collect. */
  initialUrl?: string;
  /** Open the paste panel on arrival — the refusal already said why. */
  openPaste?: boolean;
}) {
  const t = useT();
  const [url, setUrl] = useState(initialUrl);
  const [pasteOpen, setPasteOpen] = useState(openPaste);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [isListing, setIsListing] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [linkParsing, setLinkParsing] = useState(false);
  const [linkProgress, setLinkProgress] = useState({ done: 0, total: 0 });
  /** How the last "Parse first N" went, so skipped links are counted, not lost. */
  const [linkResult, setLinkResult] = useState<{ ok: number; failed: number; total: number } | null>(null);
  /** One parse at a time: a second run would land on top of the first one's results. */
  const busy = parsing || linkParsing;

  const provider = config?.fetchSettings.provider ?? "direct";

  async function callParse(target: string, html?: string): Promise<ParseResponse> {
    const res = await fetch("/api/admin/parser/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: target, ...(html ? { html } : {}) }),
    });
    return res.json();
  }

  const selectValid = (list: ParsedProduct[]) =>
    new Set(list.map((p, i) => (p.valid ? i : -1)).filter((i) => i >= 0));

  async function runParse(pasted?: { url?: string; html: string }) {
    if (busy) return;
    const given = (pasted?.url || url).trim();
    if (!given) return;
    // The address in what was pasted — share text, no scheme, an ad click's
    // tracking — shown in the field, so the admin sees the link the card keeps.
    const target = pastedUrl(given);
    if (!target) {
      setError(t("parser.parse.notALink", { example: EXAMPLE.anyProductUrl }));
      setHint("");
      return;
    }
    setParsing(true); setError(""); setHint(""); setDiag(null); setLinkResult(null);
    setProducts([]); setLinks([]); setSelected(new Set()); setIsListing(false);
    if (target !== url) setUrl(target);
    try {
      const data = await callParse(target, pasted?.html);
      setDiag(data.diagnostics ?? null);
      if (!data.ok) {
        setError(data.error ?? t("parser.parse.failed"));
        setHint(data.hint ?? "");
        setLinks(data.links ?? []);
        // `hint` is only ever filled by blockHint, so it having text means the
        // store refused us — and the panel that answers that opens itself
        // rather than being named in a paragraph the admin has to act on.
        if (data.hint) setPasteOpen(true);
        return;
      }
      const prods = data.products ?? [];
      setProducts(prods);
      setIsListing(!!data.isListing);
      setLinks(data.links ?? []);
      setSelected(selectValid(prods));
    } catch {
      setError(t("common.networkError"));
    } finally {
      setParsing(false);
    }
  }

  async function parseAllLinks() {
    if (busy) return;
    const targets = links.slice(0, 24);
    if (!targets.length) return;
    setLinkParsing(true); setLinkResult(null); setLinkProgress({ done: 0, total: targets.length });
    const collected: ParsedProduct[] = [];
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      try {
        const data = await callParse(targets[i]);
        if (data.ok && data.products?.length) collected.push(data.products[0]);
        else failed++;
      } catch {
        failed++;
      }
      setLinkProgress({ done: i + 1, total: targets.length });
    }
    setLinkParsing(false);
    setLinkResult({ ok: collected.length, failed, total: targets.length });
    // Nothing parsed: say so and keep the links, so the admin is not left
    // looking at an empty screen with nothing to retry.
    if (!collected.length) {
      setError(t("parser.parse.noneParsed", { count: targets.length }));
      setHint("");
      return;
    }
    setError(""); setHint("");
    setProducts(collected);
    setIsListing(true);
    setLinks([]);
    setSelected(selectValid(collected));
  }

  const setProductAt = (i: number, patch: Partial<ParsedProduct>) =>
    setProducts((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const toggle = (i: number) =>
    setSelected((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const single = products.length === 1 && !isListing;

  return (
    <div className="space-y-5">
      {/* URL input */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className={FIELD_LABEL}>{t("parser.parse.urlLabel")}</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && runParse()}
            placeholder={EXAMPLE.productUrl}
            spellCheck={false}
            className={inputCls}
          />
        </div>
        <button onClick={() => runParse()} disabled={busy || !url.trim()} className={btn("primary")}>
          {parsing && <Spinner />} {parsing ? t("parser.parse.fetching") : t("parser.parse.parse")}
        </button>
      </div>
      <p className="text-[12px] text-[var(--foreground-subtle)] -mt-3">
        {fill(t("parser.parse.fetchMode"), {
          provider: <span className="text-[var(--foreground-muted)] font-mono">{provider}</span>,
        })}
        {provider !== "direct" && !config?.key.configured && (
          <span className="text-[var(--warn)]"> · {t("parser.parse.noKey", { tab: t("parser.tab.fetch") })}</span>
        )}
      </p>

      <PastePagePanel
        open={pasteOpen}
        onToggle={() => setPasteOpen((v) => !v)}
        onParse={(pasted) => runParse(pasted)}
        parsing={busy}
        urlHint={url.trim()}
      />

      {error && (
        <div className={`${BANNER.err} space-y-1`}>
          <p>{error}</p>
          {hint && <p className="text-[var(--foreground-muted)] leading-relaxed">{hint}</p>}
          {hint && (
            <div className="pt-1.5">
              <Link href={EXTENSION_PAGE} className={btn("secondary")}>
                {t("parser.extension")}
              </Link>
            </div>
          )}
        </div>
      )}

      {diag && <DiagnosticsBar diag={diag} />}

      {linkResult && linkResult.ok > 0 && (
        linkResult.failed > 0 ? (
          <div className={BANNER.warn}>
            {t("parser.parse.partial", { ok: linkResult.ok, total: linkResult.total, failed: linkResult.failed })}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--foreground-muted)]">
            {t("parser.parse.done", { ok: linkResult.ok, total: linkResult.total })}
          </p>
        )
      )}

      {/* Listing page: product links to parse individually */}
      {links.length > 0 && (
        <LinksPanel count={links.length} parsing={linkParsing} progress={linkProgress} onParseAll={parseAllLinks} />
      )}

      {/* Single product — full editor */}
      {single && (
        <SingleProductEditor product={products[0]} onChange={(patch) => setProductAt(0, patch)} />
      )}

      {/* Listing / multiple products — selectable grid */}
      {products.length > 0 && !single && (
        <ProductGrid
          products={products}
          selected={selected}
          onToggle={toggle}
          onSelectAllValid={() => setSelected(selectValid(products))}
          onClear={() => setSelected(new Set())}
          setProductAt={setProductAt}
        />
      )}
    </div>
  );
}

// ── Paste page — the way past a store that refuses us ────────────────────────
//
// A store can refuse our server; it cannot refuse the admin's own browser,
// which is already looking at the page. This takes that page and runs the
// normal pipeline on it — no proxy, no provider, no cost.

function PastePagePanel({
  open,
  onToggle,
  onParse,
  parsing,
  urlHint,
}: {
  /** Owned by the tab: a refused fetch opens this panel without a click. */
  open: boolean;
  onToggle: () => void;
  onParse: (pasted: { url?: string; html: string }) => void;
  parsing: boolean;
  urlHint: string;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  // React refuses to render a `javascript:` href, so the bookmarklet is
  // attached to the node directly — dragging the link to the bookmarks bar is
  // the whole point of it being a link.
  const dragRef = useCallback((node: HTMLAnchorElement | null) => {
    if (node) node.setAttribute("href", bookmarkletHref());
  }, []);

  const pasted = readPastedPage(text);
  const kb = Math.max(1, Math.round(text.length / 1024));
  const ready = !!pasted && (!!pasted.url || !!urlHint);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left"
      >
        <span className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] shrink-0">
          {t("parser.paste.title")}
        </span>
        <span className="text-[12px] text-[var(--foreground-subtle)] text-right">
          {open ? t("parser.hide") : t("parser.paste.teaser")}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-[var(--border)] pt-4">
          <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed">
            {t("parser.paste.intro")}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              ref={dragRef}
              onClick={(e) => e.preventDefault()}
              className="px-3 py-1.5 text-[13px] font-medium border border-dashed border-[var(--border-strong)] text-[var(--foreground)] rounded-lg cursor-grab"
              title={t("parser.paste.dragTitle")}
            >
              {t("parser.paste.bookmarklet")}
            </a>
            <span className="text-[12px] text-[var(--foreground-subtle)]">
              {t("parser.paste.dragHint")}
            </span>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(bookmarkletHref());
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
              className={btn("secondary")}
            >
              {copied ? t("parser.paste.copied") : t("parser.paste.copy")}
            </button>
          </div>

          <div>
            <label className={FIELD_LABEL}>{t("parser.paste.htmlLabel")}</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("parser.paste.placeholder")}
              spellCheck={false}
              rows={4}
              className={`${monoInputCls} resize-y`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
              <p className="text-[12px] text-[var(--foreground-subtle)] break-all">
                {text
                  ? pasted?.url
                    ? t("parser.paste.sizeUrl", { kb, url: pasted.url })
                    : t("parser.paste.sizeField", { kb })
                  : t("parser.paste.empty")}
              </p>
              <div className="flex items-center gap-2">
                {text && (
                  <button onClick={() => setText("")} className={btn("ghost")}>{t("parser.clear")}</button>
                )}
                <button
                  onClick={() => pasted && onParse(pasted)}
                  disabled={parsing || !ready}
                  className={btn("primary")}
                >
                  {parsing && <Spinner />} {t("parser.paste.parse")}
                </button>
              </div>
            </div>
            {text && !pasted?.url && !urlHint && (
              <p className="text-[12px] text-[var(--warn)] mt-1.5">
                {t("parser.paste.needUrl", { field: t("parser.parse.urlLabel") })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single-product editor ────────────────────────────────────────────────────

function SingleProductEditor({
  product,
  onChange,
}: {
  product: ParsedProduct;
  onChange: (patch: Partial<ParsedProduct>) => void;
}) {
  const t = useT();
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState("");
  const set = <K extends keyof ParsedProduct>(k: K, v: ParsedProduct[K]) =>
    onChange({ [k]: v } as Partial<ParsedProduct>);

  async function runImport() {
    setImporting(true); setError(""); setImported(null);
    try {
      const res = await fetch("/api/admin/parser/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, sourceUrl: product.sourceUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? t("parser.edit.importFailed")); return; }
      setImported(data as ImportOutcome);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">{t("parser.edit.title")}</p>
        {product.valid ? (
          <Badge tone="ok">{t("parser.edit.ready")}</Badge>
        ) : (
          // The parser's own words, one badge each, so a long one wraps to a line of its own.
          <div className="flex flex-wrap gap-1.5">
            {product.issues.map((issue) => (
              <Badge key={issue} tone="warn">{issue}</Badge>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-5">
        {/* Images */}
        <div>
          <div className="aspect-[3/4] bg-[var(--background)] rounded-lg overflow-hidden border border-[var(--border)]">
            {product.imageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full grid place-items-center text-[12px] text-[var(--foreground-subtle)]">{t("parser.noImage")}</div>}
          </div>
          {product.images.length > 1 && (
            <div className="mt-2 flex gap-1.5 flex-wrap">
              {product.images.slice(0, 8).map((img) => (
                <button
                  key={img}
                  onClick={() => set("imageUrl", img)}
                  aria-label={t("parser.edit.useImage", { n: product.images.indexOf(img) + 1 })}
                  aria-pressed={img === product.imageUrl}
                  className={`w-8 h-10 rounded-lg overflow-hidden border ${img === product.imageUrl ? "border-[var(--foreground)]" : "border-[var(--border)]"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <p className="text-[12px] text-[var(--foreground-subtle)] mt-1.5">{t("parser.edit.images", { count: product.images.length })}</p>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <Field label={t("parser.f.name")}>
            <input className={inputCls} value={product.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("parser.f.brand")}>
              <input className={inputCls} value={product.brand} onChange={(e) => set("brand", e.target.value)} />
            </Field>
            <Field label={t("parser.f.material")}>
              <input className={inputCls} value={product.material} onChange={(e) => set("material", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={t("parser.f.category")}>
              <select className={selectCls} value={product.category} onChange={(e) => set("category", e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={t("parser.f.gender")}>
              <select className={selectCls} value={product.gender ?? ""} onChange={(e) => set("gender", (e.target.value || undefined) as Gender | undefined)}>
                <option value="">—</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label={t("parser.f.currency")}>
              <input className={inputCls} value={product.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} maxLength={3} />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("parser.f.price")}>
              <input type="number" className={inputCls} value={product.price || ""} onChange={(e) => set("price", Number(e.target.value) || 0)} />
            </Field>
            <Field label={t("parser.f.priceOriginal")}>
              <input type="number" className={inputCls} value={product.priceOriginal || ""} onChange={(e) => set("priceOriginal", Number(e.target.value) || 0)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("parser.f.colors")}>
              <input className={inputCls} value={product.colors.join(", ")} onChange={(e) => set("colors", splitList(e.target.value))} />
            </Field>
            <Field label={t("parser.f.sizes")}>
              <input className={inputCls} value={product.sizes.join(", ")} onChange={(e) => set("sizes", splitList(e.target.value))} />
            </Field>
          </div>
          <Field label={t("parser.f.description")}>
            <textarea className={`${inputCls} h-20 resize-y`} value={product.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center gap-3 flex-wrap">
        <button onClick={runImport} disabled={importing || !product.name} className={btn("primary")}>
          {importing && <Spinner />} {importing ? t("parser.edit.importing") : t("parser.edit.import")}
        </button>
        {error && <span className="text-[12px] text-[var(--err)]">{error}</span>}
        {imported && (
          <span className="text-[12px] text-[var(--ok)] flex items-center gap-2 flex-wrap">
            {importHeadline(imported, t)}
            {imported.productId && (
              <a href={`/product/${imported.productId}`} target="_blank" rel="noreferrer" className="underline hover:no-underline">
                {t("parser.openProduct")}
              </a>
            )}
            <a href="/goo-studio/products" className="underline hover:no-underline">{t("parser.allProducts")}</a>
          </span>
        )}
        {imported && importDetails(imported, t) && (
          <p className="text-[11px] text-[var(--foreground-muted)] basis-full leading-relaxed">{importDetails(imported, t)}</p>
        )}
        {typeof imported?.warning === "string" && <p className={`${BANNER.warn} basis-full`}>{imported.warning}</p>}
      </div>
    </div>
  );
}

// ── Multi-product grid (listing pages) ───────────────────────────────────────

function ProductGrid({
  products,
  selected,
  onToggle,
  onSelectAllValid,
  onClear,
  setProductAt,
}: {
  products: ParsedProduct[];
  selected: Set<number>;
  onToggle: (i: number) => void;
  onSelectAllValid: () => void;
  onClear: () => void;
  setProductAt: (i: number, patch: Partial<ParsedProduct>) => void;
}) {
  const t = useT();
  const f = useFormat();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{
    ok: number;
    failed: number;
    /** Pages that joined a card we already had, as another store. */
    joined: number;
    /** Pages grouped with other colors of their piece. */
    grouped: number;
    warnings: string[];
  } | null>(null);

  async function importSelected() {
    const idxs = [...selected];
    if (!idxs.length) return;
    setImporting(true); setResult(null); setProgress({ done: 0, total: idxs.length });
    let ok = 0, failed = 0, joined = 0, grouped = 0;
    const warnings = new Set<string>();
    for (let i = 0; i < idxs.length; i++) {
      const product = products[idxs[i]];
      try {
        const res = await fetch("/api/admin/parser/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product, sourceUrl: product.sourceUrl }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          ok++;
          if (data.mergedInto) joined++;
          if (data.variantsLinked) grouped++;
        } else failed++;
        if (typeof data.warning === "string") warnings.add(data.warning);
      } catch { failed++; }
      setProgress({ done: i + 1, total: idxs.length });
    }
    setResult({ ok, failed, joined, grouped, warnings: [...warnings] });
    setImporting(false);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-4 flex-wrap">
        <p className="text-[13px] font-medium text-[var(--foreground)]">
          {t("parser.grid.found", { count: products.length })} · {t("bulk.selected", { count: selected.size })}
        </p>
        <button onClick={onSelectAllValid} className={btn("ghost")}>{t("parser.grid.selectValid")}</button>
        <button onClick={onClear} className={btn("ghost")}>{t("parser.clear")}</button>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {importing && (
            <span className="text-[11px] text-[var(--foreground-muted)]">
              {t("parser.grid.progress", { done: progress.done, total: progress.total })}
            </span>
          )}
          {result && (
            <span className="text-[11px] text-[var(--ok)]">
              {[
                t("parser.grid.imported", { count: result.ok }),
                result.joined ? t("parser.grid.joined", { count: result.joined }) : "",
                result.grouped ? t("parser.grid.grouped", { count: result.grouped }) : "",
                result.failed ? t("parser.grid.failed", { count: result.failed }) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              <a href="/goo-studio/products" className="underline hover:no-underline ml-2">{t("parser.grid.view")}</a>
            </span>
          )}
          <button onClick={importSelected} disabled={importing || !selected.size} className={btn("primary")}>
            {importing && <Spinner />}{" "}
            {selected.size ? t("parser.grid.import", { count: selected.size }) : t("parser.grid.importNone")}
          </button>
        </div>
        {result?.warnings.map((w) => <p key={w} className={`${BANNER.warn} basis-full`}>{w}</p>)}
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.map((p, i) => {
          const sel = selected.has(i);
          return (
            <div
              key={i}
              className={`rounded-lg border overflow-hidden transition-colors ${sel ? "border-[var(--foreground)]" : "border-[var(--border)]"}`}
            >
              <button onClick={() => onToggle(i)} className="block w-full text-left relative">
                <div className="aspect-[3/4] bg-[var(--background)]">
                  {p.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full grid place-items-center text-[12px] text-[var(--foreground-subtle)]">{t("parser.noImage")}</div>}
                </div>
                <span className={`absolute top-2 left-2 w-4 h-4 rounded-full flex items-center justify-center border ${sel ? "bg-[var(--foreground)] border-[var(--foreground)]" : "bg-[var(--bg-overlay-90)] border-[var(--border-strong)]"}`}>
                  {sel && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="var(--surface)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </span>
                {!p.valid && (
                  // A badge keeps to one line, so the corner shows the issue's head
                  // ("currency not stated") and the tooltip says the rest.
                  <span className="absolute top-2 right-2">
                    <Badge tone="warn" title={p.issues.join("; ")}>{p.issues[0].split(" — ")[0]}</Badge>
                  </span>
                )}
              </button>
              <div className="p-2 space-y-1.5">
                <input
                  value={p.name}
                  onChange={(e) => setProductAt(i, { name: e.target.value })}
                  className="w-full bg-transparent text-[11px] text-[var(--foreground)] outline-none border-b border-transparent focus:border-[var(--border-strong)] leading-tight"
                />
                <div className="flex items-center justify-between text-[11px] text-[var(--foreground-muted)]">
                  <span className="truncate">{p.brand || "—"}</span>
                  <span className="tabular-nums">{p.price ? f.money(p.price, p.currency || "USD") : "—"}</span>
                </div>
                <div className="flex gap-1">
                  <select
                    value={p.category}
                    onChange={(e) => setProductAt(i, { category: e.target.value as Category })}
                    className="flex-1 min-w-0 bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--foreground)] text-[11px] text-[var(--foreground-muted)] px-1 py-1 rounded-lg outline-none"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={p.gender ?? ""}
                    onChange={(e) => setProductAt(i, { gender: (e.target.value || undefined) as Gender | undefined })}
                    className="bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--foreground)] text-[11px] text-[var(--foreground-muted)] px-1 py-1 rounded-lg outline-none"
                  >
                    <option value="">—</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                {p.sourceUrl && (
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="block text-[11px] text-[var(--foreground-subtle)] hover:text-[var(--foreground)] truncate">
                    {t("parser.grid.source")}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Listing links panel ──────────────────────────────────────────────────────

function LinksPanel({
  count,
  parsing,
  progress,
  onParseAll,
}: {
  count: number;
  parsing: boolean;
  progress: { done: number; total: number };
  onParseAll: () => void;
}) {
  const t = useT();
  const cap = Math.min(count, 24);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <p className="text-[12px] text-[var(--foreground)]">{t("parser.links.found", { count })}</p>
        <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">
          {t("parser.links.text")}
        </p>
      </div>
      <button onClick={onParseAll} disabled={parsing} className={btn("primary")}>
        {parsing ? (
          <>
            <Spinner /> {t("parser.links.parsing", { done: progress.done, total: progress.total })}
          </>
        ) : (
          t("parser.links.parseFirst", { count: cap })
        )}
      </button>
    </div>
  );
}

function DiagnosticsBar({ diag }: { diag: Diagnostics }) {
  const t = useT();
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] text-[var(--foreground-muted)]">
      <span>{t("parser.diag.http")} <span className={`font-mono ${diag.status >= 200 && diag.status < 300 ? "text-[var(--ok)]" : "text-[var(--err)]"}`}>{diag.status || "—"}</span></span>
      <span>{t("parser.diag.html")} <span className="font-mono text-[var(--foreground)]">{t("parser.diag.kb", { kb: Math.round(diag.htmlLength / 1024) })}</span></span>
      <span>{t("parser.diag.via")} <span className="font-mono text-[var(--foreground)]">{diag.provider}</span></span>
      <span>{t("parser.diag.recipe")} <span className="font-mono text-[var(--foreground)]">{diag.matchedConfig?.name ?? t("parser.diag.none")}</span></span>
      {diag.strategies && diag.strategies.length > 0 && (
        <span>{t("parser.diag.extracted")} <span className="font-mono text-[var(--ok)]">{diag.strategies.join(", ")}</span></span>
      )}
      {diag.strategies && diag.strategies.length === 0 && (
        <span className="text-[var(--warn)]">{t("parser.diag.noStructured")}</span>
      )}
      {diag.aiFields && diag.aiFields.length > 0 && (
        <span>{t("parser.diag.aiFilled")} <span className="text-[var(--foreground)]">{diag.aiFields.join(", ")}</span></span>
      )}
      {diag.aiError && <span className="text-[var(--warn)]">{diag.aiError}</span>}
    </div>
  );
}

/** A label and its one field. The label wraps the field, so it names it for screen readers and a click on it focuses it. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={FIELD_LABEL}>{label}</span>
      {children}
    </label>
  );
}

function splitList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * JSON with object keys sorted, so a draft compares equal to what was saved
 * whatever order its fields happened to be set in.
 */
function stableJson(v: unknown): string {
  return JSON.stringify(v, (_key, val: unknown) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : val,
  );
}

// ── Recipes tab ──────────────────────────────────────────────────────────────

function RecipesTab({ config, onSaved }: { config: ConfigState; onSaved: (c: ParserSiteConfig[]) => void }) {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<ParserSiteConfig[]>(config.siteConfigs);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (id: string, patch: Partial<ParserSiteConfig>) =>
    setItems((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const updateRule = (id: string, field: ParserRuleField, regex: string) =>
    setItems((arr) =>
      arr.map((c) => {
        if (c.id !== id) return c;
        const rules = { ...(c.rules ?? {}) };
        if (regex.trim()) rules[field] = { regex: regex.trim() };
        else delete rules[field];
        return { ...c, rules: Object.keys(rules).length ? rules : undefined };
      }),
    );

  const addRecipe = () => {
    const id = crypto.randomUUID();
    setItems((arr) => [...arr, { id, name: t("parser.recipes.newName"), domain: "", enabled: false }]);
    setExpanded(id);
  };

  const remove = (id: string) => setItems((arr) => arr.filter((c) => c.id !== id));

  const dirty = stableJson(items) !== stableJson(config.siteConfigs);

  // The page's SaveBar saves and says how it went in a toast (DESIGN_SYSTEM.md §9).
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/parser/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteConfigs: items }),
      });
      const data = await res.json();
      if (!res.ok) { toast.err(data.error ?? t("parser.saveFailed")); return; }
      setItems(data.siteConfigs);
      onSaved(data.siteConfigs);
      toast.ok(t("common.saved"));
    } catch {
      toast.err(t("common.networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-[var(--foreground-muted)]">
            {t("parser.recipes.intro")}
          </p>
          <button onClick={addRecipe} className={btn("secondary")}>
            {PLUS}
            {t("parser.recipes.add")}
          </button>
        </div>

        <div className="space-y-2">
          {items.map((c) => {
            const name = c.name || c.domain;
            return (
              <div key={c.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                {/* Row header */}
                {/* Below md the domain takes a line of its own. */}
                <div className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <Toggle
                    on={c.enabled}
                    onChange={(v) => update(c.id, { enabled: v })}
                    ariaLabel={name ? t("parser.recipes.useNamed", { name }) : t("parser.recipes.useNew")}
                  />
                  <input
                    value={c.name}
                    onChange={(e) => update(c.id, { name: e.target.value })}
                    aria-label={t("parser.recipes.name")}
                    className="bg-transparent text-[13px] text-[var(--foreground)] outline-none flex-1 min-w-0 md:flex-none md:w-40 border-b border-transparent focus:border-[var(--border-strong)]"
                  />
                  <input
                    value={c.domain}
                    onChange={(e) => update(c.id, { domain: e.target.value })}
                    placeholder={EXAMPLE.domain}
                    aria-label={t("parser.recipes.domain")}
                    className="bg-transparent text-[12px] font-mono text-[var(--foreground-muted)] outline-none order-last basis-full md:order-none md:basis-auto flex-1 min-w-0 border-b border-transparent focus:border-[var(--border-strong)]"
                  />
                  <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className={btn("ghost", "sm")}>
                    {expanded === c.id ? t("parser.hide") : t("parser.recipes.edit")}
                  </button>
                  <button
                    onClick={() => remove(c.id)}
                    aria-label={name ? t("parser.recipes.deleteNamed", { name }) : t("parser.recipes.deleteNew")}
                    className={BTN_ICON}
                    title={t("parser.recipes.delete")}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                  </button>
                </div>

                {/* Expanded editor */}
                {expanded === c.id && (
                  <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                      <Field label={t("parser.recipes.brandOverride")}>
                        <input className={inputCls} value={c.brandOverride ?? ""} onChange={(e) => update(c.id, { brandOverride: e.target.value || undefined })} />
                      </Field>
                      <Field label={t("parser.recipes.categoryOverride")}>
                        <select className={selectCls} value={c.categoryOverride ?? ""} onChange={(e) => update(c.id, { categoryOverride: (e.target.value || undefined) as Category | undefined })}>
                          <option value="">—</option>
                          {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </Field>
                      <Field label={t("parser.recipes.genderOverride")}>
                        <select className={selectCls} value={c.genderOverride ?? ""} onChange={(e) => update(c.id, { genderOverride: (e.target.value || undefined) as Gender | undefined })}>
                          <option value="">—</option>
                          {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </Field>
                    </div>

                    <Field label={t("parser.recipes.notes")}>
                      <input className={inputCls} value={c.notes ?? ""} onChange={(e) => update(c.id, { notes: e.target.value || undefined })} />
                    </Field>

                    <div>
                      <p className="text-[13px] font-medium text-[var(--foreground)] mb-2">
                        {t("parser.recipes.rules")}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {RULE_FIELDS.map((field) => (
                          <div key={field} className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-[var(--foreground-muted)] w-20 flex-shrink-0">{field}</span>
                            <input
                              className={monoInputCls}
                              placeholder={t("parser.recipes.regex")}
                              value={c.rules?.[field]?.regex ?? ""}
                              onChange={(e) => updateRule(c.id, field, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setItems(config.siteConfigs)} />
    </>
  );
}

// ── Fetch & anti-bot tab ─────────────────────────────────────────────────────

function FetchTab({ config, onSaved }: { config: ConfigState; onSaved: (c: ConfigState) => void }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [settings, setSettings] = useState<ParserFetchSettings>(config.fetchSettings);
  const [ai, setAi] = useState<ParserAiSettings>(config.aiSettings);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Removing the stored key is a request of its own, not a save of the draft. */
  const [clearing, setClearing] = useState(false);

  const set = <K extends keyof ParserFetchSettings>(k: K, v: ParserFetchSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const keyFromEnv = config.key.source === "env";

  const dirty =
    stableJson(settings) !== stableJson(config.fetchSettings) ||
    stableJson(ai) !== stableJson(config.aiSettings) ||
    (!keyFromEnv && !!keyInput.trim());

  // The page's SaveBar saves and says how it went in a toast (DESIGN_SYSTEM.md §9).
  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { fetchSettings: settings, aiSettings: ai };
      if (!keyFromEnv && keyInput.trim()) payload.fetchKey = keyInput.trim();
      const res = await fetch("/api/admin/parser/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.err(data.error ?? t("parser.saveFailed")); return; }
      onSaved(data);
      // The server clamps and trims what it stores; show that, so the draft
      // matches the saved state instead of reading as unsaved.
      setSettings(data.fetchSettings);
      setAi(data.aiSettings);
      setKeyInput("");
      toast.ok(t("common.saved"));
    } catch {
      toast.err(t("common.networkError"));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setSettings(config.fetchSettings);
    setAi(config.aiSettings);
    setKeyInput("");
  }

  async function clearKey() {
    if (
      !(await confirm({
        title: t("parser.fetch.clearConfirm"),
        confirmLabel: t("parser.fetch.clearAction"),
        tone: "danger",
      }))
    ) return;
    setClearing(true);
    try {
      const res = await fetch("/api/admin/parser/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fetchKey: "" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.err(data.error ?? t("parser.fetch.clearFailed")); return; }
      onSaved(data);
    } catch {
      toast.err(t("common.networkError"));
    } finally {
      setClearing(false);
    }
  }

  const providerMeta = PROVIDERS.find((p) => p.value === settings.provider)!;
  const needsKey = settings.provider !== "direct";
  // Only direct mode (as the User-Agent) and a custom endpoint (`{impersonate}`)
  // use the profile; only providers render JS. A setting shown where it does
  // nothing is a setting someone will spend a morning adjusting.
  const usesImpersonate = settings.provider === "direct" || settings.provider === "custom";
  const usesRenderJs = settings.provider !== "direct";

  return (
    <>
      <FormPanel>
        {/* Provider */}
        <FormSection id="parser-fetch" title={t("parser.fetch.fetching")} description={t("parser.fetch.fetchingHint")}>
          <Field label={t("parser.fetch.provider")}>
            <select className={selectCls} value={settings.provider} onChange={(e) => set("provider", e.target.value as FetchProvider)}>
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{t(p.label)}</option>)}
            </select>
          </Field>
          <p className="text-[11px] text-[var(--foreground-muted)] -mt-1 leading-relaxed">{t(providerMeta.hint)}</p>

          {settings.provider === "custom" && (
            <Field label={t("parser.fetch.endpoint")}>
              <input
                className={monoInputCls}
                placeholder={EXAMPLE.endpoint}
                value={settings.endpoint}
                onChange={(e) => set("endpoint", e.target.value)}
              />
            </Field>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {usesImpersonate && (
              <Field label={t("parser.fetch.impersonate")}>
                <select className={selectCls} value={settings.impersonate} onChange={(e) => set("impersonate", e.target.value)}>
                  {IMPERSONATE.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
            )}
            <Field label={t("parser.fetch.timeout")}>
              <input type="number" className={inputCls} value={settings.timeoutMs} onChange={(e) => set("timeoutMs", Number(e.target.value) || 20000)} />
            </Field>
          </div>

          {usesRenderJs && (
            <Toggle
              on={settings.renderJs}
              onChange={(v) => set("renderJs", v)}
              label={t("parser.fetch.renderJs")}
            />
          )}
        </FormSection>

        {/* AI extraction + image storage */}
        <FormSection
          id="parser-ai"
          title={t("parser.fetch.ai")}
          extra={
            config.openai.configured ? (
              <Badge tone="ok">{t("parser.fetch.openaiFound")}</Badge>
            ) : (
              <Badge tone="warn">{t("parser.fetch.openaiMissing")}</Badge>
            )
          }
        >
          <Toggle
            on={ai.enabled}
            disabled={!config.openai.configured}
            onChange={(v) => setAi((s) => ({ ...s, enabled: v }))}
            label={t("parser.fetch.aiEnabled")}
          />

          {ai.enabled && (
            <Field label={t("parser.fetch.aiMode")}>
              <select className={selectCls} value={ai.mode} onChange={(e) => setAi((s) => ({ ...s, mode: e.target.value as ParserAiSettings["mode"] }))}>
                <option value="auto">{t("parser.fetch.aiAuto")}</option>
                <option value="always">{t("parser.fetch.aiAlways")}</option>
              </select>
            </Field>
          )}

          <Toggle
            on={ai.downloadImages}
            onChange={(v) => setAi((s) => ({ ...s, downloadImages: v }))}
            label={t("parser.fetch.downloadImages")}
          />
          <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed -mt-1">
            {t("parser.fetch.downloadHint")}
          </p>
        </FormSection>

        {/* API key */}
        {needsKey && (
          <FormSection id="parser-key" title={t("parser.fetch.key")}>
            {/* A block around the badge, or the column would stretch it to full width. */}
            <div>
              {config.key.configured ? (
                <Badge tone="ok">
                  {config.key.source === "env"
                    ? t("parser.fetch.keyEnv", { masked: config.key.masked })
                    : t("parser.fetch.keyStored", { masked: config.key.masked })}
                </Badge>
              ) : (
                <Badge tone="warn">{t("parser.fetch.keyNotSet")}</Badge>
              )}
            </div>
            {keyFromEnv ? (
              <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed">
                {fill(t("parser.fetch.keyEnvText"), {
                  name: <code className="font-mono text-[11px]">{EXAMPLE.keyEnv}</code>,
                })}
              </p>
            ) : (
              <>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    className={`${monoInputCls} pr-10 md:pr-9`}
                    placeholder={config.key.configured ? t("parser.fetch.keyReplace") : t("parser.fetch.keyPaste")}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? t("parser.fetch.hideKey") : t("parser.fetch.showKey")} className="absolute right-0 md:right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 md:w-auto md:h-auto flex items-center justify-center text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                      {!showKey && <path d="M2 2L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />}
                    </svg>
                  </button>
                </div>
                {config.key.configured && config.key.source === "database" && (
                  <button onClick={clearKey} disabled={clearing} className={`${btn("danger")} self-start`}>
                    {t("parser.fetch.clearKey")}
                  </button>
                )}
              </>
            )}
          </FormSection>
        )}
      </FormPanel>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} disabled={clearing} />
    </>
  );
}
