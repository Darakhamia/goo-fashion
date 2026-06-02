"use client";

import { useState } from "react";
import Link from "next/link";

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
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/report-bug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, url, section, reporter, priority }),
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
  }

  const priorityColors: Record<string, string> = {
    urgent: "text-red-400",
    high: "text-orange-400",
    medium: "text-yellow-400",
    low: "text-green-400",
  };

  if (result) {
    const { structured } = result;
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-start justify-center pt-20 pb-12 px-4">
        <div className="w-full max-w-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            <span className="text-white/50 text-sm uppercase tracking-widest">Issue created</span>
          </div>

          <h1 className="text-2xl font-semibold mb-8">{structured.title}</h1>

          <div className="space-y-5 mb-8">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Priority</p>
              <p className={`font-medium ${priorityColors[structured.priority] ?? "text-white"}`}>
                {structured.priority}
              </p>
            </div>

            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Шаги воспроизведения</p>
              <ol className="list-decimal list-inside space-y-1">
                {structured.steps.map((step, i) => (
                  <li key={i} className="text-white/80 text-sm">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Ожидалось</p>
              <p className="text-white/80 text-sm">{structured.expected}</p>
            </div>

            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Фактически</p>
              <p className="text-white/80 text-sm">{structured.actual}</p>
            </div>
          </div>

          <button
            onClick={resetForm}
            className="w-full py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm"
          >
            Submit another bug
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-start justify-center pt-20 pb-12 px-4">
      <div className="w-full max-w-xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <span className="text-white/40 text-sm uppercase tracking-widest">Internal</span>
          </div>
          <h1 className="text-3xl font-semibold">Bug Report</h1>
          <p className="text-white/40 text-sm mt-2">Claude structures it, Plane tracks it.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">
              Bug description <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what's broken..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Page URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://goo-fashion.com/..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors appearance-none"
              >
                {SECTIONS.map((s) => (
                  <option key={s} value={s} className="bg-[#1a1a1a]">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Reporter</label>
              <select
                value={reporter}
                onChange={(e) => setReporter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors appearance-none"
              >
                {REPORTERS.map((r) => (
                  <option key={r} value={r} className="bg-[#1a1a1a]">
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                    priority === p.value
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/8 bg-transparent text-white/40 hover:text-white/60"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
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
