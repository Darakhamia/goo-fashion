"use client";

import { useEffect, useState } from "react";
import type {
  ParserFetchSettings,
  ParserSiteConfig,
  ParsedProduct,
  FetchProvider,
  ParserRuleField,
} from "@/lib/server/parser/types";
import type { Category, Gender } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  "outerwear", "blazers", "tops", "shirts", "knitwear", "bottoms", "jeans",
  "shorts", "skirts", "dresses", "jumpsuits", "swimwear", "footwear", "bags", "accessories",
];
const GENDERS: Gender[] = ["women", "men", "unisex"];
const PROVIDERS: { value: FetchProvider; label: string; hint: string }[] = [
  { value: "direct", label: "Direct", hint: "Node fetch with browser headers. Works for soft targets only." },
  { value: "scrapingbee", label: "ScrapingBee", hint: "Managed scraping API with JS render + proxies." },
  { value: "scraperapi", label: "ScraperAPI", hint: "Managed scraping API with rotating proxies." },
  { value: "zenrows", label: "ZenRows", hint: "Managed scraping API with anti-bot bypass." },
  { value: "custom", label: "Custom endpoint", hint: "Your own curl_cffi / playwright service. Use {url}, {key}, {render}." },
];
const IMPERSONATE = ["chrome", "safari", "firefox", "edge"];
const RULE_FIELDS: ParserRuleField[] = [
  "name", "brand", "price", "currency", "image", "sizes", "color", "material", "description",
];

interface ConfigState {
  fetchSettings: ParserFetchSettings;
  key: { configured: boolean; source: "env" | "database" | null; masked: string };
  siteConfigs: ParserSiteConfig[];
}

type Diagnostics = {
  provider: string;
  status: number;
  htmlLength: number;
  finalUrl: string;
  matchedConfig: { id: string; name: string; domain: string } | null;
  strategies?: string[];
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

type Tab = "parse" | "recipes" | "fetch";

// ── Tiny styled primitives ───────────────────────────────────────────────────

const inputCls =
  "w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-[12px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors rounded-lg";
const labelCls = "block text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1.5";
const btnPrimary =
  "px-4 py-2 text-[11px] tracking-[0.12em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5 rounded-lg";
const btnGhost =
  "px-4 py-2 text-[11px] tracking-[0.12em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors rounded-lg";
const Spinner = () => (
  <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
);

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ParserPage() {
  const [tab, setTab] = useState<Tab>("parse");
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/parser/config");
        if (!active) return;
        if (res.status === 401) { setUnauthorized(true); return; }
        if (!res.ok) { setLoadError("Failed to load parser config."); return; }
        setConfig(await res.json());
      } catch {
        if (active) setLoadError("Network error loading config.");
      }
    })();
    return () => { active = false; };
  }, []);

  if (unauthorized) {
    return (
      <div className="max-w-lg">
        <Header />
        <div className="mt-6 rounded-xl border border-[var(--border)] px-5 py-4">
          <p className="text-[12px] text-[var(--foreground-muted)] leading-relaxed">
            Access denied. Your account is not in the admin allowlist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Header />

      {/* Tabs */}
      <div className="flex items-center gap-1 mt-6 mb-6 border-b border-[var(--border)]">
        {([["parse", "Parse URL"], ["recipes", "Site Recipes"], ["fetch", "Fetch & Anti-bot"]] as [Tab, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-[11px] tracking-[0.12em] uppercase transition-colors -mb-px border-b-2 ${
                tab === key
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {loadError && <p className="text-[12px] text-red-500 mb-4">{loadError}</p>}

      {tab === "parse" && <ParseTab config={config} />}
      {tab === "recipes" && config && (
        <RecipesTab config={config} onSaved={(c) => setConfig((s) => (s ? { ...s, siteConfigs: c } : s))} />
      )}
      {tab === "fetch" && config && (
        <FetchTab config={config} onSaved={(next) => setConfig(next)} />
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="text-[9px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-1">Admin / Import</p>
      <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Universal Parser</h1>
      <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
        Import a single product from any store URL (Farfetch, SSENSE, brand sites). Reads JSON-LD, OpenGraph and
        microdata, with per-site recipes and a pluggable anti-bot fetcher.
      </p>
    </div>
  );
}

// ── Parse tab ────────────────────────────────────────────────────────────────

function ParseTab({ config }: { config: ConfigState | null }) {
  const [url, setUrl] = useState("");
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

  const provider = config?.fetchSettings.provider ?? "direct";

  async function callParse(target: string): Promise<ParseResponse> {
    const res = await fetch("/api/admin/parser/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: target }),
    });
    return res.json();
  }

  const selectValid = (list: ParsedProduct[]) =>
    new Set(list.map((p, i) => (p.valid ? i : -1)).filter((i) => i >= 0));

  async function runParse() {
    if (!url.trim()) return;
    setParsing(true); setError(""); setHint(""); setDiag(null);
    setProducts([]); setLinks([]); setSelected(new Set()); setIsListing(false);
    try {
      const data = await callParse(url.trim());
      setDiag(data.diagnostics ?? null);
      if (!data.ok) {
        setError(data.error ?? "Parse failed");
        setHint(data.hint ?? "");
        setLinks(data.links ?? []);
        return;
      }
      const prods = data.products ?? [];
      setProducts(prods);
      setIsListing(!!data.isListing);
      setLinks(data.links ?? []);
      setSelected(selectValid(prods));
    } catch {
      setError("Network error");
    } finally {
      setParsing(false);
    }
  }

  async function parseAllLinks() {
    const targets = links.slice(0, 24);
    if (!targets.length) return;
    setLinkParsing(true); setLinkProgress({ done: 0, total: targets.length });
    const collected: ParsedProduct[] = [];
    for (let i = 0; i < targets.length; i++) {
      try {
        const data = await callParse(targets[i]);
        if (data.ok && data.products?.length) collected.push(data.products[0]);
      } catch { /* skip failed link */ }
      setLinkProgress({ done: i + 1, total: targets.length });
    }
    setProducts(collected);
    setIsListing(true);
    setLinks([]);
    setSelected(selectValid(collected));
    setLinkParsing(false);
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
          <label className={labelCls}>Product URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runParse()}
            placeholder="https://www.farfetch.com/shopping/men/..."
            spellCheck={false}
            className={inputCls}
          />
        </div>
        <button onClick={runParse} disabled={parsing || !url.trim()} className={btnPrimary}>
          {parsing && <Spinner />} {parsing ? "Fetching…" : "Parse"}
        </button>
      </div>
      <p className="text-[10px] text-[var(--foreground-subtle)] -mt-3">
        Fetch mode: <span className="text-[var(--foreground-muted)] font-mono">{provider}</span>
        {provider !== "direct" && !config?.key.configured && (
          <span className="text-amber-500"> · no API key set (Fetch &amp; Anti-bot tab)</span>
        )}
      </p>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-[12px] text-red-400 space-y-1">
          <p>{error}</p>
          {hint && <p className="text-[var(--foreground-muted)] leading-relaxed">{hint}</p>}
        </div>
      )}

      {diag && <DiagnosticsBar diag={diag} />}

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

// ── Single-product editor ────────────────────────────────────────────────────

function SingleProductEditor({
  product,
  onChange,
}: {
  product: ParsedProduct;
  onChange: (patch: Partial<ParsedProduct>) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ updated: boolean } | null>(null);
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
      if (!res.ok || !data.ok) { setError(data.error ?? "Import failed"); return; }
      setImported({ updated: data.updated });
    } catch {
      setError("Network error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">Preview &amp; edit</p>
        {product.valid ? (
          <span className="text-[9px] tracking-[0.12em] uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Ready</span>
        ) : (
          <span className="text-[9px] tracking-[0.12em] uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded" title={product.issues.join("; ")}>
            {product.issues.join(" · ")}
          </span>
        )}
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-5">
        {/* Images */}
        <div>
          <div className="aspect-[3/4] bg-[var(--surface)] rounded-lg overflow-hidden border border-[var(--border)]">
            {product.imageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full grid place-items-center text-[10px] text-[var(--foreground-subtle)]">no image</div>}
          </div>
          {product.images.length > 1 && (
            <div className="mt-2 flex gap-1.5 flex-wrap">
              {product.images.slice(0, 8).map((img) => (
                <button
                  key={img}
                  onClick={() => set("imageUrl", img)}
                  className={`w-8 h-10 rounded overflow-hidden border ${img === product.imageUrl ? "border-[var(--foreground)]" : "border-[var(--border)]"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <p className="text-[9px] text-[var(--foreground-subtle)] mt-1.5">{product.images.length} image(s)</p>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <Field label="Name">
            <input className={inputCls} value={product.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand">
              <input className={inputCls} value={product.brand} onChange={(e) => set("brand", e.target.value)} />
            </Field>
            <Field label="Material">
              <input className={inputCls} value={product.material} onChange={(e) => set("material", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Category">
              <select className={inputCls} value={product.category} onChange={(e) => set("category", e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Gender">
              <select className={inputCls} value={product.gender ?? ""} onChange={(e) => set("gender", (e.target.value || undefined) as Gender | undefined)}>
                <option value="">—</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Currency">
              <input className={inputCls} value={product.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} maxLength={3} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <input type="number" className={inputCls} value={product.price || ""} onChange={(e) => set("price", Number(e.target.value) || 0)} />
            </Field>
            <Field label="Original price (was)">
              <input type="number" className={inputCls} value={product.priceOriginal || ""} onChange={(e) => set("priceOriginal", Number(e.target.value) || 0)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Colors (comma-sep)">
              <input className={inputCls} value={product.colors.join(", ")} onChange={(e) => set("colors", splitList(e.target.value))} />
            </Field>
            <Field label="Sizes (comma-sep)">
              <input className={inputCls} value={product.sizes.join(", ")} onChange={(e) => set("sizes", splitList(e.target.value))} />
            </Field>
          </div>
          <Field label="Description">
            <textarea className={`${inputCls} h-20 resize-y`} value={product.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center gap-3 flex-wrap">
        <button onClick={runImport} disabled={importing || !product.name} className={btnPrimary}>
          {importing && <Spinner />} {importing ? "Importing…" : "Import product"}
        </button>
        {error && <span className="text-[12px] text-red-500">{error}</span>}
        {imported && (
          <span className="text-[12px] text-emerald-500 flex items-center gap-2">
            {imported.updated ? "Updated existing product" : "Product created"}
            <a href="/goo-studio/products" className="underline hover:no-underline">View products →</a>
          </span>
        )}
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
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);

  async function importSelected() {
    const idxs = [...selected];
    if (!idxs.length) return;
    setImporting(true); setResult(null); setProgress({ done: 0, total: idxs.length });
    let ok = 0, failed = 0;
    for (let i = 0; i < idxs.length; i++) {
      const product = products[idxs[i]];
      try {
        const res = await fetch("/api/admin/parser/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product, sourceUrl: product.sourceUrl }),
        });
        const data = await res.json();
        if (res.ok && data.ok) ok++; else failed++;
      } catch { failed++; }
      setProgress({ done: i + 1, total: idxs.length });
    }
    setResult({ ok, failed });
    setImporting(false);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-4 flex-wrap">
        <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
          {products.length} products found · {selected.size} selected
        </p>
        <button onClick={onSelectAllValid} className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)]">Select valid</button>
        <button onClick={onClear} className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)]">Clear</button>
        <div className="ml-auto flex items-center gap-3">
          {importing && <span className="text-[11px] text-[var(--foreground-muted)]">{progress.done}/{progress.total}…</span>}
          {result && (
            <span className="text-[11px] text-emerald-500">
              Imported {result.ok}{result.failed ? ` · ${result.failed} failed` : ""}
              <a href="/goo-studio/products" className="underline hover:no-underline ml-2">View →</a>
            </span>
          )}
          <button onClick={importSelected} disabled={importing || !selected.size} className={btnPrimary}>
            {importing && <Spinner />} Import {selected.size || ""} selected
          </button>
        </div>
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
                <div className="aspect-[3/4] bg-[var(--surface)]">
                  {p.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full grid place-items-center text-[10px] text-[var(--foreground-subtle)]">no image</div>}
                </div>
                <span className={`absolute top-2 left-2 w-4 h-4 rounded flex items-center justify-center border ${sel ? "bg-[var(--foreground)] border-[var(--foreground)]" : "bg-[var(--background)]/80 border-[var(--border-strong)]"}`}>
                  {sel && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="var(--background)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </span>
                {!p.valid && (
                  <span className="absolute top-2 right-2 text-[8px] tracking-[0.1em] uppercase text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded" title={p.issues.join("; ")}>
                    {p.issues[0]}
                  </span>
                )}
              </button>
              <div className="p-2 space-y-1.5">
                <input
                  value={p.name}
                  onChange={(e) => setProductAt(i, { name: e.target.value })}
                  className="w-full bg-transparent text-[11px] text-[var(--foreground)] outline-none border-b border-transparent focus:border-[var(--border-strong)] leading-tight"
                />
                <div className="flex items-center justify-between text-[10px] text-[var(--foreground-muted)]">
                  <span className="truncate">{p.brand || "—"}</span>
                  <span className="font-mono tabular-nums">{p.price ? `${p.price} ${p.currency}` : "—"}</span>
                </div>
                <div className="flex gap-1">
                  <select
                    value={p.category}
                    onChange={(e) => setProductAt(i, { category: e.target.value as Category })}
                    className="flex-1 bg-[var(--surface)] border border-[var(--border)] text-[10px] text-[var(--foreground-muted)] px-1 py-1 rounded outline-none"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={p.gender ?? ""}
                    onChange={(e) => setProductAt(i, { gender: (e.target.value || undefined) as Gender | undefined })}
                    className="bg-[var(--surface)] border border-[var(--border)] text-[10px] text-[var(--foreground-muted)] px-1 py-1 rounded outline-none"
                  >
                    <option value="">—</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                {p.sourceUrl && (
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="block text-[9px] text-[var(--foreground-subtle)] hover:text-[var(--foreground)] truncate">
                    source ↗
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
  const cap = Math.min(count, 24);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-4 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <p className="text-[12px] text-[var(--foreground)]">Looks like a listing — found {count} product link{count !== 1 ? "s" : ""}.</p>
        <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">
          No full product data was embedded on this page. Parse each link to pull name, price and images, then select which to import.
        </p>
      </div>
      <button onClick={onParseAll} disabled={parsing} className={btnPrimary}>
        {parsing ? <><Spinner /> Parsing {progress.done}/{progress.total}…</> : `Parse first ${cap}`}
      </button>
    </div>
  );
}

function DiagnosticsBar({ diag }: { diag: Diagnostics }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[10px] text-[var(--foreground-muted)]">
      <span>HTTP <span className={`font-mono ${diag.status >= 200 && diag.status < 300 ? "text-emerald-500" : "text-red-400"}`}>{diag.status || "—"}</span></span>
      <span>HTML <span className="font-mono text-[var(--foreground)]">{(diag.htmlLength / 1024).toFixed(0)}kb</span></span>
      <span>Via <span className="font-mono text-[var(--foreground)]">{diag.provider}</span></span>
      <span>Recipe <span className="font-mono text-[var(--foreground)]">{diag.matchedConfig?.name ?? "none"}</span></span>
      {diag.strategies && diag.strategies.length > 0 && (
        <span>Extracted via <span className="font-mono text-emerald-500">{diag.strategies.join(", ")}</span></span>
      )}
      {diag.strategies && diag.strategies.length === 0 && (
        <span className="text-amber-500">No structured data found — add a recipe regex</span>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function splitList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Recipes tab ──────────────────────────────────────────────────────────────

function RecipesTab({ config, onSaved }: { config: ConfigState; onSaved: (c: ParserSiteConfig[]) => void }) {
  const [items, setItems] = useState<ParserSiteConfig[]>(config.siteConfigs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
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
    setItems((arr) => [...arr, { id, name: "New site", domain: "", enabled: false }]);
    setExpanded(id);
  };

  const remove = (id: string) => setItems((arr) => arr.filter((c) => c.id !== id));

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/admin/parser/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteConfigs: items }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      setItems(data.siteConfigs);
      onSaved(data.siteConfigs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[var(--foreground-muted)]">
          Recipes match by hostname. Overrides and regex rules apply on top of the generic JSON-LD/OpenGraph extractor.
        </p>
        <button onClick={addRecipe} className={btnGhost}>+ Add recipe</button>
      </div>

      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)]">
            {/* Row header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => update(c.id, { enabled: !c.enabled })}
                title={c.enabled ? "Enabled" : "Disabled"}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${c.enabled ? "bg-emerald-500" : "bg-[var(--border-strong)]"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${c.enabled ? "left-[18px]" : "left-0.5"}`} />
              </button>
              <input
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
                className="bg-transparent text-[13px] text-[var(--foreground)] outline-none w-40 border-b border-transparent focus:border-[var(--border-strong)]"
              />
              <input
                value={c.domain}
                onChange={(e) => update(c.id, { domain: e.target.value })}
                placeholder="example.com"
                className="bg-transparent text-[12px] font-mono text-[var(--foreground-muted)] outline-none flex-1 border-b border-transparent focus:border-[var(--border-strong)]"
              />
              <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                {expanded === c.id ? "Hide" : "Edit"}
              </button>
              <button onClick={() => remove(c.id)} className="text-[var(--foreground-subtle)] hover:text-red-500 transition-colors" title="Delete">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              </button>
            </div>

            {/* Expanded editor */}
            {expanded === c.id && (
              <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-4">
                <div className="grid grid-cols-3 gap-3 pt-3">
                  <Field label="Brand override">
                    <input className={inputCls} value={c.brandOverride ?? ""} onChange={(e) => update(c.id, { brandOverride: e.target.value || undefined })} />
                  </Field>
                  <Field label="Category override">
                    <select className={inputCls} value={c.categoryOverride ?? ""} onChange={(e) => update(c.id, { categoryOverride: (e.target.value || undefined) as Category | undefined })}>
                      <option value="">—</option>
                      {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </Field>
                  <Field label="Gender override">
                    <select className={inputCls} value={c.genderOverride ?? ""} onChange={(e) => update(c.id, { genderOverride: (e.target.value || undefined) as Gender | undefined })}>
                      <option value="">—</option>
                      {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Notes">
                  <input className={inputCls} value={c.notes ?? ""} onChange={(e) => update(c.id, { notes: e.target.value || undefined })} />
                </Field>

                <div>
                  <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
                    Field regex overrides (1st capture group → value)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {RULE_FIELDS.map((field) => (
                      <div key={field} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[var(--foreground-muted)] w-16 flex-shrink-0">{field}</span>
                        <input
                          className={`${inputCls} font-mono text-[11px]`}
                          placeholder="regex…"
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
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving && <Spinner />} {saving ? "Saving…" : "Save recipes"}
        </button>
        {saved && <span className="text-[12px] text-emerald-500">Saved</span>}
        {error && <span className="text-[12px] text-red-500">{error}</span>}
      </div>
    </div>
  );
}

// ── Fetch & anti-bot tab ─────────────────────────────────────────────────────

function FetchTab({ config, onSaved }: { config: ConfigState; onSaved: (c: ConfigState) => void }) {
  const [settings, setSettings] = useState<ParserFetchSettings>(config.fetchSettings);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof ParserFetchSettings>(k: K, v: ParserFetchSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const keyFromEnv = config.key.source === "env";

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const payload: Record<string, unknown> = { fetchSettings: settings };
      if (!keyFromEnv && keyInput.trim()) payload.fetchKey = keyInput.trim();
      const res = await fetch("/api/admin/parser/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      onSaved(data);
      setKeyInput("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    if (!confirm("Remove the stored fetch API key?")) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/parser/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fetchKey: "" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onSaved(data);
    } finally {
      setSaving(false);
    }
  }

  const providerMeta = PROVIDERS.find((p) => p.value === settings.provider)!;
  const needsKey = settings.provider !== "direct";

  return (
    <div className="max-w-2xl space-y-5">
      {/* Provider */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 space-y-4">
        <Field label="Fetch provider">
          <select className={inputCls} value={settings.provider} onChange={(e) => set("provider", e.target.value as FetchProvider)}>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <p className="text-[11px] text-[var(--foreground-muted)] -mt-1 leading-relaxed">{providerMeta.hint}</p>

        {settings.provider === "custom" && (
          <Field label="Custom endpoint template">
            <input
              className={`${inputCls} font-mono text-[11px]`}
              placeholder="https://my-scraper.fly.dev/fetch?token={key}&url={url}&render={render}"
              value={settings.endpoint}
              onChange={(e) => set("endpoint", e.target.value)}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Impersonate">
            <select className={inputCls} value={settings.impersonate} onChange={(e) => set("impersonate", e.target.value)}>
              {IMPERSONATE.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Timeout (ms)">
            <input type="number" className={inputCls} value={settings.timeoutMs} onChange={(e) => set("timeoutMs", Number(e.target.value) || 20000)} />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <button
            type="button"
            onClick={() => set("renderJs", !settings.renderJs)}
            className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${settings.renderJs ? "bg-emerald-500" : "bg-[var(--border-strong)]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings.renderJs ? "left-[18px]" : "left-0.5"}`} />
          </button>
          <span className="text-[12px] text-[var(--foreground)]">Render JS (headless browser — slower, needed for SPA stores)</span>
        </label>
      </div>

      {/* API key */}
      {needsKey && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">Provider API key</p>
            {config.key.configured ? (
              <span className="text-[10px] tracking-[0.1em] uppercase text-emerald-500">
                {config.key.source === "env" ? "Set via env" : "Stored"} · {config.key.masked}
              </span>
            ) : (
              <span className="text-[10px] tracking-[0.1em] uppercase text-amber-500">Not set</span>
            )}
          </div>
          {keyFromEnv ? (
            <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed">
              Key is set via the <code className="font-mono text-[10px]">PARSER_FETCH_API_KEY</code> environment variable. Update it there to change.
            </p>
          ) : (
            <>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  className={`${inputCls} pr-9 font-mono`}
                  placeholder={config.key.configured ? "Enter a new key to replace" : "Paste API key"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                    {!showKey && <path d="M2 2L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />}
                  </svg>
                </button>
              </div>
              {config.key.configured && config.key.source === "database" && (
                <button onClick={clearKey} className="text-[11px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-red-500 transition-colors">
                  Clear stored key
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving && <Spinner />} {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-[12px] text-emerald-500">Saved</span>}
        {error && <span className="text-[12px] text-red-500">{error}</span>}
      </div>
    </div>
  );
}
