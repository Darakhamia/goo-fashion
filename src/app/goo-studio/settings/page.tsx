"use client";

import { useState, useEffect } from "react";

interface KeyStatus {
  configured: boolean;
  source: "env" | "database" | null;
  maskedKey?: string;
}

// ── Homepage showcase ────────────────────────────────────────────────────────

type StepKey = "step1" | "step2" | "step3" | "step4";
type ShowcaseIds = Record<StepKey, string[]>;

interface PickerProduct {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
}

const STEP_META: { key: StepKey; n: string; title: string; hint: string; max: number }[] = [
  { key: "step1", n: "01", title: "Choose items", hint: "One product — the large reference card.", max: 1 },
  { key: "step2", n: "02", title: "Build your look", hint: "Up to 3 products scattered in the frame.", max: 3 },
  { key: "step3", n: "03", title: "Generate preview", hint: "One product shown on the preview card.", max: 1 },
  { key: "step4", n: "04", title: "Shop the look", hint: "Up to 3 products standing in the box.", max: 3 },
];

const EMPTY_SHOWCASE: ShowcaseIds = { step1: [], step2: [], step3: [], step4: [] };

export default function SettingsPage() {
  // ── OpenAI key state ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  const [inputKey, setInputKey] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [testError, setTestError] = useState("");

  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");

  // ── Homepage showcase state ───────────────────────────────────────────────
  const [showcase, setShowcase] = useState<ShowcaseIds>(EMPTY_SHOWCASE);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [pickerStep, setPickerStep] = useState<StepKey | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [showcaseSaving, setShowcaseSaving] = useState(false);
  const [showcaseOk, setShowcaseOk] = useState(false);
  const [showcaseError, setShowcaseError] = useState("");

  useEffect(() => {
    loadShowcase();
    loadProducts();
    loadStatus();
  }, []);

  // ── Showcase loaders / handlers ───────────────────────────────────────────

  async function loadShowcase() {
    try {
      const res = await fetch("/api/admin/homepage-showcase");
      if (!res.ok) return;
      const data = await res.json();
      setShowcase({
        step1: Array.isArray(data.step1) ? data.step1 : [],
        step2: Array.isArray(data.step2) ? data.step2 : [],
        step3: Array.isArray(data.step3) ? data.step3 : [],
        step4: Array.isArray(data.step4) ? data.step4 : [],
      });
    } catch { /* non-fatal */ }
  }

  async function loadProducts() {
    try {
      const res = await fetch("/api/products?raw=true");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(
          data.map((p: { id: string; name: string; brand: string; imageUrl: string }) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            imageUrl: p.imageUrl,
          }))
        );
      }
    } catch { /* non-fatal */ }
  }

  const productById = (id: string) => products.find((p) => p.id === id);

  function toggleItem(step: StepKey, id: string) {
    setShowcaseOk(false);
    const meta = STEP_META.find((m) => m.key === step)!;
    setShowcase((prev) => {
      const current = prev[step];
      if (current.includes(id)) {
        return { ...prev, [step]: current.filter((x) => x !== id) };
      }
      // Adding: single-item steps replace; multi-item steps append up to max.
      const next = meta.max === 1 ? [id] : [...current, id].slice(0, meta.max);
      return { ...prev, [step]: next };
    });
  }

  function removeItem(step: StepKey, id: string) {
    setShowcaseOk(false);
    setShowcase((prev) => ({ ...prev, [step]: prev[step].filter((x) => x !== id) }));
  }

  async function saveShowcase() {
    setShowcaseSaving(true);
    setShowcaseError("");
    setShowcaseOk(false);
    try {
      const res = await fetch("/api/admin/homepage-showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(showcase),
      });
      const json = await res.json();
      if (!res.ok) { setShowcaseError(json.error ?? "Save failed"); return; }
      setShowcaseOk(true);
      setTimeout(() => setShowcaseOk(false), 3000);
    } catch {
      setShowcaseError("Network error. Try again.");
    } finally {
      setShowcaseSaving(false);
    }
  }

  // ── Load key status on mount ──────────────────────────────────────────────

  async function loadStatus() {
    setLoadError("");
    try {
      const res = await fetch("/api/admin/settings?key=openai_api_key");
      if (res.status === 401) { setUnauthorized(true); return; }
      if (!res.ok) { setLoadError("Failed to load settings."); return; }
      const data: KeyStatus = await res.json();
      setStatus(data);
    } catch {
      setLoadError("Network error loading settings.");
    }
  }

  // ── Save new key ──────────────────────────────────────────────────────────
  async function saveKey() {
    const value = inputKey.trim();
    if (!value) return;
    setSaving(true);
    setSaveError("");
    setSaveOk(false);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "openai_api_key", value }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Save failed."); return; }
      setStatus({ configured: true, source: "database", maskedKey: json.maskedKey });
      setInputKey("");
      setShowInput(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch {
      setSaveError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Test key ──────────────────────────────────────────────────────────────
  async function testKey() {
    setTesting(true);
    setTestResult(null);
    setTestError("");
    try {
      const res = await fetch("/api/admin/settings/test", { method: "POST" });
      const json = await res.json();
      setTestResult(json.ok ? "ok" : "fail");
      if (!json.ok) setTestError(json.error ?? "Validation failed");
    } catch {
      setTestResult("fail");
      setTestError("Network error");
    } finally {
      setTesting(false);
    }
  }

  // ── Clear key ─────────────────────────────────────────────────────────────
  async function clearKey() {
    if (!confirm("Remove the stored API key? This will disable the AI Stylist for all users.")) return;
    setClearing(true);
    setClearError("");
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings?key=openai_api_key", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setClearError(json.error ?? "Clear failed.");
        return;
      }
      setStatus({ configured: false, source: null });
      setShowInput(false);
    } catch {
      setClearError("Network error. Try again.");
    } finally {
      setClearing(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (unauthorized) {
    return (
      <div className="max-w-lg">
        <h1 className="text-sm tracking-[0.18em] uppercase font-medium text-[var(--foreground)] mb-1">
          Settings
        </h1>
        <div className="mt-6 rounded-xl border border-[var(--border)] px-5 py-4">
          <p className="text-[12px] text-[var(--foreground-muted)] leading-relaxed">
            Access denied. Your account is not in the admin allowlist.
          </p>
          <p className="text-[11px] text-[var(--foreground-subtle)] mt-2 leading-relaxed">
            Add your Clerk user ID to the <code className="font-mono text-[10px]">ADMIN_USER_IDS</code> environment variable to gain access.
          </p>
        </div>
      </div>
    );
  }

  const pickerMeta = pickerStep ? STEP_META.find((m) => m.key === pickerStep)! : null;
  const filteredProducts = pickerQuery.trim()
    ? products.filter((p) =>
        `${p.name} ${p.brand}`.toLowerCase().includes(pickerQuery.trim().toLowerCase())
      )
    : products;

  return (
    <div className="max-w-lg">
      <h1 className="text-sm tracking-[0.18em] uppercase font-medium text-[var(--foreground)] mb-1">
        Settings
      </h1>
      <p className="text-xs text-[var(--foreground-muted)] mb-8">
        Configure the homepage showcase and API keys.
      </p>

      {/* ── Homepage showcase ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] mb-6">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1.5" y="2" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
              <path d="M1.5 5H12.5" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
              Homepage showcase
            </p>
          </div>
          <p className="text-[11px] text-[var(--foreground-muted)] mt-1.5 leading-relaxed">
            Pick which products appear in the four “How it works” cards on the homepage.
            Empty slots fall back to the default artwork.
          </p>
        </div>

        <div className="px-5 py-4 space-y-5">
          {STEP_META.map((meta) => (
            <div key={meta.key}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-mono text-[10px] text-[var(--foreground-subtle)] tabular-nums">{meta.n}</span>
                <span className="text-[12px] font-medium text-[var(--foreground)]">{meta.title}</span>
                <span className="text-[10px] text-[var(--foreground-subtle)] ml-auto">{meta.hint}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {showcase[meta.key].map((id) => {
                  const p = productById(id);
                  return (
                    <div
                      key={id}
                      className="relative w-14 h-14 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface)] group"
                      title={p?.name ?? id}
                    >
                      {p?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-[var(--foreground-subtle)] text-center px-1">
                          missing
                        </div>
                      )}
                      <button
                        onClick={() => removeItem(meta.key, id)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove"
                      >
                        <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                          <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  );
                })}

                {showcase[meta.key].length < meta.max && (
                  <button
                    onClick={() => { setPickerStep(meta.key); setPickerQuery(""); }}
                    className="w-14 h-14 rounded-lg border border-dashed border-[var(--border-strong)] text-[var(--foreground-subtle)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors flex items-center justify-center"
                    aria-label={`Add product to ${meta.title}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center gap-3">
          <button
            onClick={saveShowcase}
            disabled={showcaseSaving}
            className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {showcaseSaving && <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
            {showcaseSaving ? "Saving…" : "Save showcase"}
          </button>
          {showcaseOk && <p className="text-[11px] text-green-600">Saved — changes go live on next homepage load.</p>}
          {showcaseError && <p className="text-[11px] text-red-500">{showcaseError}</p>}
        </div>
      </div>

      {/* ── OpenAI section ── */}
      <div className="border border-[var(--border)] bg-[var(--background)]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1.5C5.07 1.5 3.5 3.07 3.5 5C3.5 5.37 3.56 5.73 3.67 6.06C2.57 6.38 1.75 7.39 1.75 8.58C1.75 9.8 2.61 10.83 3.76 11.09C3.97 12.04 4.81 12.75 5.83 12.75C6.27 12.75 6.68 12.62 7 12.4C7.32 12.62 7.73 12.75 8.17 12.75C9.19 12.75 10.03 12.04 10.24 11.09C11.39 10.83 12.25 9.8 12.25 8.58C12.25 7.39 11.43 6.38 10.33 6.06C10.44 5.73 10.5 5.37 10.5 5C10.5 3.07 8.93 1.5 7 1.5Z"
                stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"
              />
            </svg>
            <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
              OpenAI API Key
            </p>
          </div>
          <p className="text-[11px] text-[var(--foreground-muted)] mt-1.5 leading-relaxed">
            Shared key used by the AI Stylist for all users. Key is stored server-side and never exposed to the browser.
          </p>
        </div>

        {/* Status body */}
        <div className="px-5 py-4">

          {/* Loading */}
          {status === null && !loadError && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin text-[var(--foreground-subtle)]" />
              <p className="text-[11px] text-[var(--foreground-subtle)]">Loading…</p>
            </div>
          )}

          {/* Load error */}
          {loadError && (
            <p className="text-[11px] text-red-500">{loadError}</p>
          )}

          {/* Not configured */}
          {status && !status.configured && !showInput && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[var(--border-strong)]" />
                <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)]">
                  Not configured
                </p>
              </div>
              <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed mb-3">
                The AI Stylist is currently disabled. Add an OpenAI API key to enable it for all users.
              </p>
              <button
                onClick={() => setShowInput(true)}
                className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity"
              >
                Add API Key
              </button>
            </div>
          )}

          {/* Configured — env source */}
          {status?.configured && status.source === "env" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--foreground)]">
                  Configured
                </p>
              </div>
              {status.maskedKey && (
                <p className="font-mono text-[11px] text-[var(--foreground-muted)] mb-1">{status.maskedKey}</p>
              )}
              <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed">
                Key is set via the <code className="font-mono text-[10px]">OPENAI_API_KEY</code> environment variable.
                To change it, update the environment variable and redeploy.
              </p>
            </div>
          )}

          {/* Configured — database source */}
          {status?.configured && status.source === "database" && !showInput && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--foreground)]">
                  Configured
                </p>
              </div>
              {status.maskedKey && (
                <p className="font-mono text-[11px] text-[var(--foreground-muted)] mb-1">{status.maskedKey}</p>
              )}
              <p className="text-[11px] text-[var(--foreground-subtle)] mb-4">
                Stored in database. Raw key is never returned to the browser.
              </p>
              {saveOk && (
                <p className="text-[11px] text-green-600 mb-3">Key saved successfully.</p>
              )}
            </div>
          )}

          {/* Input form — add or update */}
          {(showInput || (status && !status.configured)) && status !== null && status.source !== "env" && (
            <div className={status?.configured ? "mt-0" : ""}>
              {status?.configured && (
                <p className="text-[11px] text-[var(--foreground-muted)] mb-3">
                  Enter a new key to replace the current one.
                </p>
              )}
              <label className="block text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
                {status?.configured ? "New API Key" : "API Key"}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showRaw ? "text" : "password"}
                    value={inputKey}
                    onChange={(e) => { setInputKey(e.target.value); setSaveError(""); }}
                    placeholder="sk-proj-..."
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 pr-9 text-[12px] font-mono text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRaw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {showRaw ? (
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2" />
                        <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M2 2L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2" />
                        <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {saveError && (
                <p className="text-[11px] text-red-500 mt-2">{saveError}</p>
              )}
            </div>
          )}

          {/* Test result */}
          {testResult === "ok" && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-green-600">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Key is valid — OpenAI API responded successfully
            </div>
          )}
          {testResult === "fail" && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-red-500">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="mt-0.5 shrink-0">
                <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>{testError || "Key invalid or no quota"}</span>
            </div>
          )}

          {/* Clear error */}
          {clearError && (
            <p className="text-[11px] text-red-500 mt-3">{clearError}</p>
          )}
        </div>

        {/* Action footer */}
        {status !== null && (
          <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center gap-2 flex-wrap">

            {/* Save button — only shown in input mode */}
            {showInput && status.source !== "env" && (
              <button
                onClick={saveKey}
                disabled={!inputKey.trim() || saving}
                className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {saving && <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
                {saving ? "Saving…" : "Save Key"}
              </button>
            )}

            {/* Cancel — only shown in update mode (key already configured) */}
            {showInput && status.configured && (
              <button
                onClick={() => { setShowInput(false); setInputKey(""); setSaveError(""); }}
                className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
            )}

            {/* Test key */}
            {status.configured && !showInput && (
              <>
                <button
                  onClick={testKey}
                  disabled={testing}
                  className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase font-medium border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {testing && <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
                  {testing ? "Testing…" : "Test Key"}
                </button>

                {/* Update key — only for database-stored keys */}
                {status.source === "database" && (
                  <button
                    onClick={() => { setShowInput(true); setTestResult(null); }}
                    className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Update
                  </button>
                )}
              </>
            )}

            {/* Clear — only for database-stored keys */}
            {status.configured && status.source === "database" && !showInput && (
              <button
                onClick={clearKey}
                disabled={clearing}
                className="ml-auto text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {clearing ? "Clearing…" : "Clear"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Schema note */}
      <div className="mt-4 border border-[var(--border)] px-4 py-3">
        <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] mb-1.5">
          Required Supabase schema
        </p>
        <pre className="font-mono text-[10px] text-[var(--foreground-muted)] whitespace-pre-wrap leading-relaxed">{`create table if not exists settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);
alter table settings enable row level security;`}</pre>
        <p className="text-[10px] text-[var(--foreground-subtle)] mt-2 leading-relaxed">
          No public access policy — the server reads this table using the service-role key only.
          Run this SQL once in the Supabase SQL editor.
        </p>
      </div>

      {/* ── Product picker modal ── */}
      {pickerStep && pickerMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setPickerStep(null)}>
          <div
            className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
              <div>
                <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
                  {pickerMeta.n} · {pickerMeta.title}
                </p>
                <p className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">
                  {showcase[pickerStep].length}/{pickerMeta.max} selected · click a product to {pickerMeta.max === 1 ? "choose" : "toggle"}
                </p>
              </div>
              <button
                onClick={() => setPickerStep(null)}
                className="ml-auto px-3 py-1.5 text-[11px] tracking-[0.12em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity"
              >
                Done
              </button>
            </div>

            <div className="px-5 py-3 border-b border-[var(--border)]">
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search by name or brand…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-[12px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors"
              />
            </div>

            <div className="overflow-y-auto p-4">
              {products.length === 0 ? (
                <p className="text-[11px] text-[var(--foreground-subtle)] text-center py-10">No products found.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {filteredProducts.map((p) => {
                    const selected = showcase[pickerStep].includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleItem(pickerStep, p.id)}
                        className={`relative rounded-lg overflow-hidden border text-left transition-colors ${
                          selected ? "border-[var(--foreground)]" : "border-[var(--border)] hover:border-[var(--foreground-muted)]"
                        }`}
                      >
                        <div className="aspect-square bg-[var(--surface)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" />
                        </div>
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center">
                            <svg width="9" height="9" viewBox="0 0 11 11" fill="none">
                              <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                        <div className="px-2 py-1.5">
                          <p className="text-[10px] font-medium text-[var(--foreground)] truncate">{p.name}</p>
                          <p className="text-[9px] text-[var(--foreground-subtle)] truncate">{p.brand}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
