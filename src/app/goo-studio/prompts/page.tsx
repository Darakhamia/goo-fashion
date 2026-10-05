"use client";

import { useState, useEffect } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { btn } from "@/app/goo-studio/_ui/recipes";
import { useT, type Key, type T } from "@/app/goo-studio/_i18n";
import { AdminPage } from "@/components/admin/AdminPage";

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

const CATEGORIES: { key: string; label: Key }[] = [
  { key: "content", label: "prompts.tab.content" },
  { key: "image", label: "prompts.tab.image" },
];

/** What each prompt is for, in the admin's language; the server's own text is the fallback. */
const DESCRIPTIONS: Record<string, Key> = {
  prompt_blog_system: "prompts.desc.prompt_blog_system",
  prompt_blog_user: "prompts.desc.prompt_blog_user",
  prompt_blog_brief: "prompts.desc.prompt_blog_brief",
  prompt_email: "prompts.desc.prompt_email",
  prompt_image_fidelity: "prompts.desc.prompt_image_fidelity",
  prompt_image_mannequin: "prompts.desc.prompt_image_mannequin",
  prompt_image_flatlay: "prompts.desc.prompt_image_flatlay",
  prompt_image_tryon: "prompts.desc.prompt_image_tryon",
};

function describe(t: T, item: PromptItem): string {
  const key = DESCRIPTIONS[item.key];
  return key ? t(key) : item.description;
}

function PromptCard({ item, onSave, onReset }: {
  item: PromptItem;
  /** Resolves to "reset" when an empty text was saved, i.e. back to default. */
  onSave: (key: string, value: string) => Promise<"saved" | "reset">;
  onReset: (key: string) => Promise<void>;
}) {
  const confirm = useConfirm();
  const t = useT();
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
      setErr(e instanceof Error ? e.message : t("prompts.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!(await confirm({
      title: t("prompts.resetConfirm.title", { label: item.label }),
      confirmLabel: t("prompts.resetConfirm.action"),
      tone: "danger",
    }))) return;
    setResetting(true); setErr("");
    try {
      await onReset(item.key);
      setText(item.default);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("prompts.resetFailed"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] rounded-xl overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[var(--border)] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">
              {item.label}
            </p>
            {isModified && (
              <span className="text-[11px] font-medium px-2 py-0.5 bg-[var(--background)] border border-[var(--border-strong)] text-[var(--foreground-muted)] rounded-full leading-none">
                {t("prompts.custom")}
              </span>
            )}
          </div>
          <p className="text-[12px] text-[var(--foreground-muted)] leading-relaxed">
            {describe(t, item)}
          </p>
          {item.required.length > 0 && (
            <p className="text-[12px] text-[var(--foreground-subtle)] leading-relaxed mt-1">
              {t("prompts.required")} <span className="font-mono">{item.required.join(" ")}</span>
            </p>
          )}
        </div>
        <span className="text-[12px] text-[var(--foreground-subtle)] shrink-0 mt-0.5 tabular-nums">
          {text.length}
        </span>
      </div>

      <div className="px-4 py-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={item.label}
          rows={8}
          spellCheck={false}
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg focus:border-[var(--foreground)] outline-none px-3 py-2.5 text-[11px] font-mono text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors resize-y leading-relaxed"
        />
        {missing.length > 0 && (
          <p className="text-[12px] text-[var(--warn)] mt-1.5">
            {t("prompts.missing", { count: missing.length, list: missing.join(" ") })}
          </p>
        )}
        {isEmpty && isDirty && (
          <p className="text-[12px] text-[var(--foreground-muted)] mt-1.5">
            {t("prompts.emptyResets")}
          </p>
        )}
        {err && <p className="text-[12px] text-[var(--err)] mt-1.5">{err}</p>}
        {ok  && <p className="text-[12px] text-[var(--ok)] mt-1.5">{t("common.saved")}</p>}
      </div>

      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving || missing.length > 0}
          className={btn("primary")}
        >
          {saving && <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />}
          {t(saving ? "common.saving" : "common.save")}
        </button>
        {isDirty && !saving && (
          <button
            onClick={() => setText(item.value ?? item.default)}
            className={btn("ghost")}
          >
            {t("common.cancel")}
          </button>
        )}
        {isModified && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className={`${btn("ghost")} ml-auto`}
          >
            {t(resetting ? "common.resetting" : "common.reset")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PromptsPage() {
  const t = useT();
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Which failure, not its text: the message follows the admin language.
  const [loadErr, setLoadErr] = useState<"" | "load" | "network">("");
  const [activeTab, setActiveTab] = useState("content");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setLoadErr("");
    try {
      const res = await fetch("/api/admin/prompts");
      if (!res.ok) { setLoadErr("load"); return; }
      setPrompts(await res.json());
    } catch {
      setLoadErr("network");
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
    if (!res.ok) throw new Error(j.error ?? t("prompts.saveFailed"));
    // The server stores the trimmed text, or nothing at all for an empty one.
    const stored = j.reset ? null : value.trim();
    setPrompts((prev) => prev.map((p) => p.key === key ? { ...p, value: stored } : p));
    return j.reset ? "reset" : "saved";
  }

  async function handleReset(key: string) {
    const res = await fetch(`/api/admin/prompts?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? t("prompts.resetFailed"));
    }
    setPrompts((prev) => prev.map((p) => p.key === key ? { ...p, value: null } : p));
  }

  const activePrompts = prompts.filter((p) => p.category === activeTab);
  const customCount = (cat: string) => prompts.filter((p) => p.category === cat && p.value !== null).length;

  return (
    <AdminPage layout="form">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">
          {t("nav.prompts")}
        </h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          {t("prompts.subtitle")}
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
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
                activeTab === cat.key
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t(cat.label)}
              {count > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 bg-[var(--background)] border border-[var(--border-strong)] text-[var(--foreground-muted)] rounded-full leading-none tabular-nums">
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
          <span className="text-[11px]">{t("common.loading")}</span>
        </div>
      )}
      {loadErr && <p className="text-[11px] text-[var(--err)]">{t(loadErr === "load" ? "prompts.loadFailed" : "common.networkError")}</p>}

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
    </AdminPage>
  );
}
