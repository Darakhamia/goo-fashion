"use client";

import { useState } from "react";

type Step = { step: string; status: "ok" | "error"; detail?: string };

type Result = {
  steps: Step[];
  originalUrl?: string;
  mirroredUrl?: string | null;
  removedUrl?: string | null;
  error?: string;
};

const STEP_LABELS: Record<string, string> = {
  download_original: "Download original image",
  mirror_to_storage: "Mirror to Supabase Storage",
  remove_background: "Remove background (Replicate)",
  upload_result: "Upload result to Supabase Storage",
};

const SAMPLE_URLS = [
  "https://cdn-images.farfetch-contents.com/18/15/60/82/18156082_37998426_1000.jpg",
  "https://cdn-images.farfetch-contents.com/19/43/67/48/19436748_43847254_1000.jpg",
];

function StepRow({ step, index }: { step: Step; index: number }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <div
        className={`w-5 h-5 flex-shrink-0 flex items-center justify-center text-[10px] font-mono mt-0.5 ${
          step.status === "ok"
            ? "bg-emerald-500/15 text-emerald-600"
            : "bg-red-500/15 text-red-500"
        }`}
      >
        {step.status === "ok" ? "✓" : "✗"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs tracking-[0.08em] text-[var(--foreground)]">
          {index + 1}. {STEP_LABELS[step.step] ?? step.step}
        </p>
        {step.detail && (
          <p className="text-[10px] text-[var(--foreground-subtle)] font-mono mt-0.5 truncate">
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
}

function ImagePanel({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isPng = url.endsWith(".png") || url.includes("replicate");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">{label}</p>
      <div
        className="relative aspect-[3/4] border border-[var(--border)] overflow-hidden flex items-center justify-center"
        style={{
          background: isPng
            ? "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 0 / 16px 16px"
            : "var(--surface)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="max-w-full max-h-full object-contain" />
      </div>
      <button
        onClick={copy}
        className="flex items-center gap-1.5 text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <rect x="4" y="4" width="7" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 4V2.5A0.5 0.5 0 0 0 7.5 2H1.5A0.5 0.5 0 0 0 1 2.5V8.5A0.5 0.5 0 0 0 1.5 9H4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {copied ? "Copied!" : "Copy URL"}
      </button>
    </div>
  );
}

export default function ImageToolsPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [activeTab, setActiveTab] = useState<"url" | "info">("url");

  const process = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/image-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: trimmed }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ steps: [], error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[9px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-1">
          Admin / Tools
        </p>
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">
          Image Tools
        </h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1.5 tracking-wide">
          Test the full flow: mirror image → remove background via Replicate → save to Supabase Storage.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-px bg-[var(--border)] w-fit mb-6">
        {(["url", "info"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-5 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors ${
              activeTab === t
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--surface)]"
            }`}
          >
            {t === "url" ? "Test by URL" : "Setup info"}
          </button>
        ))}
      </div>

      {activeTab === "info" && (
        <div className="border border-[var(--border)] p-6 space-y-4 text-xs text-[var(--foreground-muted)] leading-relaxed tracking-wide">
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-2">Required env vars</p>
            <div className="font-mono space-y-1.5">
              <div className="flex items-center gap-3">
                <code className="text-[var(--foreground)]">REPLICATE_API_TOKEN</code>
                <span>— from replicate.com → Account → API tokens</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="text-[var(--foreground)]">SUPABASE_URL</code>
                <span>— already configured if products are loading</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="text-[var(--foreground)]">SUPABASE_SERVICE_ROLE_KEY</code>
                <span>— already configured if products are loading</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-2">Replicate model</p>
            <code className="text-[var(--foreground)] font-mono">851-labs/background-remover</code>
            <p className="mt-1">~$0.005 per image · returns PNG with transparent background · ~5–15s per image</p>
          </div>
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-2">Storage bucket</p>
            <code className="text-[var(--foreground)] font-mono">product-images</code>
            <p className="mt-1">Created automatically on first use. Stores both mirrored originals and processed PNGs.</p>
          </div>
        </div>
      )}

      {activeTab === "url" && (
        <div className="space-y-6">
          {/* Input */}
          <div className="border border-[var(--border)] p-5 space-y-4">
            <div>
              <label className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] block mb-2">
                Image URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://cdn-images.farfetch-contents.com/..."
                className="w-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-xs px-3 py-2.5 font-mono focus:outline-none focus:border-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]"
                onKeyDown={(e) => { if (e.key === "Enter") process(); }}
              />
            </div>

            {/* Sample URLs */}
            <div>
              <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1.5">
                Sample Farfetch URLs
              </p>
              <div className="flex flex-col gap-1">
                {SAMPLE_URLS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setUrl(s)}
                    className="text-left text-[10px] font-mono text-[var(--foreground-muted)] hover:text-[var(--foreground)] truncate transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={process}
              disabled={loading || !url.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-[var(--foreground)] text-[var(--background)] text-[10px] tracking-[0.16em] uppercase hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="14 10" />
                  </svg>
                  Processing…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Run
                </>
              )}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-5">
              {/* Steps log */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2.5 border-b border-[var(--border)]">
                  <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">
                    Steps
                  </p>
                </div>
                <div className="px-4">
                  {result.error && (
                    <p className="py-3 text-xs text-red-500 font-mono">{result.error}</p>
                  )}
                  {result.steps.map((s, i) => (
                    <StepRow key={s.step} step={s} index={i} />
                  ))}
                </div>
              </div>

              {/* Images comparison */}
              {(result.originalUrl || result.removedUrl) && (
                <div>
                  <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-4">
                    Result
                  </p>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {result.originalUrl && (
                      <ImagePanel label="Original" url={result.originalUrl} />
                    )}
                    {result.mirroredUrl && (
                      <ImagePanel label="Mirrored (our storage)" url={result.mirroredUrl} />
                    )}
                    {result.removedUrl && (
                      <ImagePanel label="Background removed" url={result.removedUrl} />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
