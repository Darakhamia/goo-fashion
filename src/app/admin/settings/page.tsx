"use client";

import { useState, useEffect } from "react";

const KEY_STORAGE = "goo-openai-key";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [testError, setTestError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(KEY_STORAGE);
    if (stored) setApiKey(stored);
  }, []);

  const saveKey = () => {
    localStorage.setItem(KEY_STORAGE, apiKey.trim());
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearKey = () => {
    localStorage.removeItem(KEY_STORAGE);
    setApiKey("");
    setTestResult(null);
  };

  const testKey = async () => {
    const key = apiKey.trim();
    if (!key) return;
    setTesting(true);
    setTestResult(null);
    setTestError("");
    try {
      const res = await fetch("/api/generate-outfit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-openai-key": key,
        },
        body: JSON.stringify({
          pieces: [
            {
              slot: "top",
              name: "Test item",
              brand: "Test",
              category: "tops",
              styleKeywords: ["minimal"],
            },
          ],
        }),
      });
      const json = await res.json();
      if (res.ok && json.imageUrl) {
        setTestResult("ok");
      } else {
        setTestResult("fail");
        setTestError(json.error ?? "Unknown error");
      }
    } catch {
      setTestResult("fail");
      setTestError("Network error");
    } finally {
      setTesting(false);
    }
  };

  const maskedKey = apiKey
    ? apiKey.slice(0, 8) + "•".repeat(Math.min(24, apiKey.length - 12)) + apiKey.slice(-4)
    : "";

  return (
    <div className="max-w-lg">
      <h1 className="text-sm tracking-[0.18em] uppercase font-medium text-[var(--foreground)] mb-1">
        Settings
      </h1>
      <p className="text-xs text-[var(--foreground-muted)] mb-8">
        Configure API keys for platform integrations.
      </p>

      {/* ── OpenAI section ── */}
      <div className="border border-[var(--border)] bg-[var(--background)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            {/* OpenAI logo‑like icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1.5C5.07 1.5 3.5 3.07 3.5 5C3.5 5.37 3.56 5.73 3.67 6.06C2.57 6.38 1.75 7.39 1.75 8.58C1.75 9.8 2.61 10.83 3.76 11.09C3.97 12.04 4.81 12.75 5.83 12.75C6.27 12.75 6.68 12.62 7 12.4C7.32 12.62 7.73 12.75 8.17 12.75C9.19 12.75 10.03 12.04 10.24 11.09C11.39 10.83 12.25 9.8 12.25 8.58C12.25 7.39 11.43 6.38 10.33 6.06C10.44 5.73 10.5 5.37 10.5 5C10.5 3.07 8.93 1.5 7 1.5Z"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
              OpenAI API Key
            </p>
          </div>
          <p className="text-[11px] text-[var(--foreground-muted)] mt-1.5 leading-relaxed">
            Used by the AI Stylist to generate outfit images in the Builder.
            Get your key at{" "}
            <span className="text-[var(--foreground)]">platform.openai.com/api-keys</span>
          </p>
        </div>

        {/* Input */}
        <div className="px-5 py-4">
          <label className="block text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
            API Key
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                placeholder="sk-proj-..."
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 pr-9 text-[12px] font-mono text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors"
              />
              {/* show/hide toggle */}
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
              >
                {showKey ? (
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

          {/* Masked preview when saved */}
          {!showKey && apiKey && (
            <p className="text-[10px] text-[var(--foreground-subtle)] mt-1.5 font-mono">
              {maskedKey}
            </p>
          )}

          {/* Test result */}
          {testResult === "ok" && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-green-600">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Key works — generation successful
            </div>
          )}
          {testResult === "fail" && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-red-600">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="mt-0.5 shrink-0">
                <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>{testError || "Key invalid or no quota"}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center gap-2">
          <button
            onClick={saveKey}
            disabled={!apiKey.trim()}
            className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>

          <button
            onClick={testKey}
            disabled={!apiKey.trim() || testing}
            className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase font-medium border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {testing && (
              <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            )}
            {testing ? "Testing…" : "Test Key"}
          </button>

          {apiKey && (
            <button
              onClick={clearKey}
              className="ml-auto text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-[var(--foreground-subtle)] mt-4 leading-relaxed">
        The key is saved locally in your browser (localStorage) and sent with each generation request.
        It is not stored on the server.
      </p>
    </div>
  );
}
