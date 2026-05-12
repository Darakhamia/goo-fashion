"use client";

import { useState, useEffect } from "react";

interface PromptItem {
  key: string;
  label: string;
  description: string;
  default: string;
  value: string | null;
}

function PromptCard({ item, onSave, onReset }: {
  item: PromptItem;
  onSave: (key: string, value: string) => Promise<void>;
  onReset: (key: string) => Promise<void>;
}) {
  const [text, setText] = useState(item.value ?? item.default);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const isModified = item.value !== null;
  const isDirty = text !== (item.value ?? item.default);

  async function handleSave() {
    setSaving(true);
    setErr("");
    setOk(false);
    try {
      await onSave(item.key, text);
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
    setResetting(true);
    setErr("");
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
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
              {item.label}
            </p>
            {isModified && (
              <span className="text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5 bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--foreground-muted)] rounded-md leading-none">
                кастом
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed">
            {item.description}
          </p>
        </div>
        <span className="text-[10px] text-[var(--foreground-subtle)] shrink-0 mt-0.5">
          {text.length} символов
        </span>
      </div>

      {/* Textarea */}
      <div className="px-5 py-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2.5 text-[12px] font-mono text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors resize-y leading-relaxed"
        />
        {err && <p className="text-[11px] text-red-500 mt-2">{err}</p>}
        {ok && <p className="text-[11px] text-green-600 mt-2">Сохранено.</p>}
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {saving && <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>

        {isDirty && !saving && (
          <button
            onClick={() => setText(item.value ?? item.default)}
            className="px-4 py-2 text-[11px] tracking-[0.12em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Отменить
          </button>
        )}

        {isModified && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="ml-auto text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] hover:text-red-500 transition-colors disabled:opacity-30"
          >
            {resetting ? "Сброс…" : "Сбросить до дефолта"}
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

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setLoadErr("");
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

  async function handleSave(key: string, value: string) {
    const res = await fetch("/api/admin/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Save failed");
    }
    setPrompts((prev) =>
      prev.map((p) => p.key === key ? { ...p, value } : p)
    );
  }

  async function handleReset(key: string) {
    const res = await fetch(`/api/admin/prompts?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Reset failed");
    }
    setPrompts((prev) =>
      prev.map((p) => p.key === key ? { ...p, value: null } : p)
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-sm tracking-[0.18em] uppercase font-medium text-[var(--foreground)] mb-1">
        Prompts
      </h1>
      <p className="text-xs text-[var(--foreground-muted)] mb-8">
        Редактируй промты для генерации контента. Изменения применяются сразу, без редеплоя.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-[var(--foreground-subtle)]">
          <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px]">Загрузка…</span>
        </div>
      )}

      {loadErr && (
        <p className="text-[11px] text-red-500">{loadErr}</p>
      )}

      {!loading && !loadErr && (
        <div className="flex flex-col gap-4">
          {prompts.map((item) => (
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
