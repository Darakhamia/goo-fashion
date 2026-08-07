"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { SignedOut } from "@clerk/nextjs";

const SECTIONS = [
  "AI Stylist",
  "Каталог/Фильтры",
  "Карточка товара",
  "Корзина/Checkout",
  "Авторизация",
  "Профиль",
  "Другое",
];

const REPORTERS = ["David", "Damir", "Venya", "Mikha", "Vlados"];

const PRIORITIES = [
  { value: "urgent", label: "Urgent", active: "border-red-500 bg-red-500/15 text-red-400", dot: "bg-red-400" },
  { value: "high", label: "High", active: "border-orange-500 bg-orange-500/15 text-orange-400", dot: "bg-orange-400" },
  { value: "medium", label: "Medium", active: "border-blue-500 bg-blue-500/15 text-blue-400", dot: "bg-blue-400" },
  { value: "low", label: "Low", active: "border-green-500 bg-green-500/15 text-green-400", dot: "bg-green-400" },
];

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  medium: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  low: "bg-green-500/15 text-green-400 border border-green-500/30",
};

interface StructuredBug {
  title: string;
  steps: string[];
  expected: string;
  actual: string;
  priority: string;
}

interface Result {
  structured: StructuredBug;
  planeIssue: { id: string; sequence_id?: number };
}

export default function ReportPage() {
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [section, setSection] = useState(SECTIONS[0]);
  const [reporter, setReporter] = useState(REPORTERS[0]);
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    // Matches the server's base64 ceiling in /api/report-bug — a bigger file
    // would sail past this check and be rejected only after the upload.
    if (file.size > 3.5 * 1024 * 1024) {
      setError("Screenshot must be under 3.5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      setScreenshot({ base64, mime: file.type, preview: dataUrl });
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/report-bug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          url,
          section,
          reporter,
          priority,
          screenshotBase64: screenshot?.base64 ?? null,
          screenshotMime: screenshot?.mime ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setDescription("");
    setUrl("");
    setSection(SECTIONS[0]);
    setReporter(REPORTERS[0]);
    setPriority("medium");
    setResult(null);
    setError(null);
    setScreenshot(null);
  }

  // ── Success state ──────────────────────────────────────────────
  if (result) {
    const { structured } = result;
    const badge = PRIORITY_BADGE[structured.priority] ?? "bg-white/10 text-white/60";
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[600px] bg-[#111] border border-white/8 rounded-2xl p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <span className="text-white font-semibold tracking-tight text-lg">GOO</span>
            <span className="text-[11px] uppercase tracking-widest text-white/30 border border-white/10 px-2 py-0.5 rounded-full">
              Internal Tool
            </span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
            <span className="text-green-400 text-xs uppercase tracking-widest">Issue created</span>
          </div>

          <h2 className="text-xl font-semibold mb-3">{structured.title}</h2>

          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-6 ${badge}`}>
            {structured.priority}
          </span>

          <div className="space-y-4 mb-8 text-sm">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1.5">Шаги воспроизведения</p>
              <ol className="list-decimal list-inside space-y-1">
                {structured.steps.map((step, i) => (
                  <li key={i} className="text-white/70">{step}</li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Ожидалось</p>
              <p className="text-white/70">{structured.expected}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Фактически</p>
              <p className="text-white/70">{structured.actual}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href="https://plane.goo-fashion.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 rounded-xl bg-white text-black text-sm font-medium text-center hover:bg-white/90 transition-colors"
            >
              View in Plane →
            </a>
            <button
              onClick={resetForm}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white hover:border-white/25 transition-colors"
            >
              Report another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[600px] bg-[#111] border border-white/8 rounded-2xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-white font-semibold tracking-tight text-lg">GOO</span>
              <span className="text-white/20">·</span>
              <span className="text-white font-medium">Bug Report</span>
            </div>
            <p className="text-white/30 text-xs">Claude structures it, Plane tracks it.</p>
          </div>
          <span className="text-[11px] uppercase tracking-widest text-white/30 border border-white/10 px-2 py-0.5 rounded-full">
            Internal Tool
          </span>
        </div>

        {/* Filing a report spends Anthropic credit, so the API requires a signed-in
            user. Say so up front rather than letting someone write a report and
            collect a 401 on submit. */}
        <SignedOut>
          <div className="mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
            <Link href="/login?redirect_url=%2Freport" className="text-white underline underline-offset-2">
              Sign in
            </Link>{" "}
            to file a bug report.
          </div>
        </SignedOut>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Description */}
          <div>
            <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">
              Bug description <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опиши что сломалось..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 resize-none transition-colors"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Page URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://goo-fashion.com/..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Section + Reporter */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/25 transition-colors appearance-none"
              >
                {SECTIONS.map((s) => (
                  <option key={s} value={s} className="bg-[#1a1a1a]">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Reporter</label>
              <select
                value={reporter}
                onChange={(e) => setReporter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/25 transition-colors appearance-none"
              >
                {REPORTERS.map((r) => (
                  <option key={r} value={r} className="bg-[#1a1a1a]">{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority pills */}
          <div>
            <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all border flex items-center justify-center gap-1.5 ${
                    priority === p.value
                      ? p.active
                      : "border-white/8 bg-transparent text-white/35 hover:text-white/55"
                  }`}
                >
                  {priority === p.value && (
                    <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                  )}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Screenshot upload */}
          <div>
            <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">
              Screenshot <span className="text-white/25 normal-case font-normal">optional · max 10MB</span>
            </label>

            {screenshot ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshot.preview} alt="screenshot" className="w-full max-h-48 object-cover" />
                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 flex flex-col items-center gap-2 transition-colors ${
                  dragging ? "border-white/30 bg-white/5" : "border-white/10 hover:border-white/20"
                }`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <p className="text-white/30 text-sm">Click or drag & drop</p>
                <p className="text-white/20 text-xs">JPG, PNG, GIF, WEBP</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : (
              "Submit Bug Report"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
