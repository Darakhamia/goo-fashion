"use client";

import { useState, useEffect } from "react";

interface PromptItem {
  key: string;
  label: string;
  description: string;
  default: string;
  value: string | null;
  category: string;
  /** Placeholders the generator fills in; a saved prompt must keep all of them. */
  required: string[];
}

const CATEGORIES = [
  { key: "content", label: "Content", description: "Blog & Email" },
  { key: "image",   label: "Image Gen", description: "Builder output" },
];

function PromptCard({ item, onSave, onReset }: {
  item: PromptItem;
  /** Resolves to "reset" when an empty text was saved, i.e. back to default. */
  onSave: (key: string, value: string) => Promise<"saved" | "reset">;
  onReset: (key: string) => Promise<void>;
}) {
  const [text, setText] = useState(item.value ?? item.default);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const isModified = item.value !== null;
  const isDirty = text !== (item.value ?? item.default);
  // Empty text saves as a reset, so only a non-empty text has to carry the
  // placeholders.
  const isEmpty = !text.trim();
  const missing = isEmpty ? [] : item.required.filter((p) => !text.includes(p));

  async function handleSave() {
    setSaving(true); setErr(""); setOk(false);
    try {
      const result = await onSave(item.key, text);
      // Match what was stored: the default after a reset, the trimmed text
      // otherwise — so the card does not stay "dirty" over whitespace.
      setText(result === "reset" ? item.default : text.trim());
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Сбросить до дефолтного промта?")) return;
    setResetting(true); setErr("");
    try {
      await onReset(item.key);
      setText(item.default);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="border border-[var(--border)] bg-[var(--background)] rounded-xl overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[var(--border)] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
              {item.label}
            </p>
            {isModified && (
              <span className="text-[10px] tracking-[0.14em] uppercase px-2 py-0.5 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--foreground-muted)] rounded-full leading-none">
                кастом
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--foreground-muted)] leading-relaxed">
            {item.description}
          </p>
          {item.required.length > 0 && (
            <p className="text-[10px] text-[var(--foreground-subtle)] leading-relaxed mt-1">
              Обязательно: <span className="font-mono">{item.required.join(" ")}</span>
            </p>
          )}
        </div>
        <span className="text-[10px] text-[var(--foreground-subtle)] shrink-0 mt-0.5 tabular-nums">
          {text.length}
        </span>
      </div>

      <div className="px-4 py-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:border-[var(--foreground)] outline-none px-3 py-2.5 text-[11px] font-mono text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors resize-y leading-relaxed"
        />
        {missing.length > 0 && (
          <p className="text-[10px] text-amber-500 mt-1.5">
            Не хватает <span className="font-mono">{missing.join(" ")}</span> — без {missing.length > 1 ? "них" : "него"} генерация пойдёт без этих данных.
          </p>
        )}
        {isEmpty && isDirty && (
          <p className="text-[10px] text-[var(--foreground-muted)] mt-1.5">
            Пустой промт сохранится как сброс до дефолтного.
          </p>
        )}
        {err && <p className="text-[10px] text-red-500 mt-1.5">{err}</p>}
        {ok  && <p className="text-[10px] text-emerald-500 mt-1.5">Сохранено.</p>}
      </div>

      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving || missing.length > 0}
          className="px-3 py-1.5 rounded-lg text-[10px] tracking-[0.12em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {saving && <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />}
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        {isDirty && !saving && (
          <button
            onClick={() => setText(item.value ?? item.default)}
            className="px-3 py-1.5 rounded-lg text-[10px] tracking-[0.12em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Отмена
          </button>
        )}
        {isModified && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="ml-auto text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] hover:text-red-500 transition-colors disabled:opacity-30"
          >
            {resetting ? "Сброс…" : "Сброс"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [activeTab, setActiveTab] = useState("content");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setLoadErr("");
    try {
      const res = await fetch("/api/admin/prompts");
      if (!res.ok) { setLoadErr("Не удалось загрузить промты"); return; }
      setPrompts(await res.json());
    } catch {
      setLoadErr("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key: string, value: string): Promise<"saved" | "reset"> {
    const res = await fetch("/api/admin/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Save failed");
    // The server stores the trimmed text, or nothing at all for an empty one.
    const stored = j.reset ? null : value.trim();
    setPrompts((prev) => prev.map((p) => p.key === key ? { ...p, value: stored } : p));
    return j.reset ? "reset" : "saved";
  }

  async function handleReset(key: string) {
    const res = await fetch(`/api/admin/prompts?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Reset failed");
    }
    setPrompts((prev) => prev.map((p) => p.key === key ? { ...p, value: null } : p));
  }

  const activePrompts = prompts.filter((p) => p.category === activeTab);
  const customCount = (cat: string) => prompts.filter((p) => p.category === cat && p.value !== null).length;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">
          Prompts
        </h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Промты генерации постов блога, AI-писем и картинок образа. Изменения применяются сразу без редеплоя.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--border)]">
        {CATEGORIES.map((cat) => {
          const count = customCount(cat.key);
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[11px] tracking-[0.12em] uppercase transition-colors border-b-2 -mb-px ${
                activeTab === cat.key
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {cat.label}
              {count > 0 && (
                <span className="text-[8px] px-1.5 py-0.5 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--foreground-muted)] rounded-full leading-none tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[var(--foreground-subtle)]">
          <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px]">Загрузка…</span>
        </div>
      )}
      {loadErr && <p className="text-[11px] text-red-500">{loadErr}</p>}

      {!loading && !loadErr && (
        <div className={`grid gap-4 ${activeTab === "image" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {activePrompts.map((item) => (
            <PromptCard
              key={item.key}
              item={item}
              onSave={handleSave}
              onReset={handleReset}
            />
          ))}
        </div>
      )}
    </div>
  );
}
