"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { ParserSiteConfig, ParserAiSettings, ParserRuleField } from "@/lib/server/parser/types";
import type { Category, Gender } from "@/lib/types";
import { useToast } from "@/components/admin/Toast";
import { PageHeader, PLUS } from "@/components/admin/PageHeader";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { Badge } from "@/components/admin/Badge";
import { FormPanel, FormSection } from "@/components/admin/FormSection";
import { SaveBar } from "@/components/admin/SaveBar";
import { Tabs, tabPanel } from "@/components/admin/Tabs";
import { BANNER, btn, BTN_ICON, FIELD_LABEL, INPUT, PANEL, SELECT } from "../_ui/recipes";
import { AdminPage } from "@/components/admin/AdminPage";
import { useT, type Key } from "@/app/goo-studio/_i18n";

/*
 * Stores come into the catalog through the browser extension: it opens their
 * pages in the admin's own Chrome and hands them to the collect screen
 * (`/goo-studio/parser/collect`). This page leads there, and holds the two
 * settings the extension's imports run on — site recipes, and AI & images.
 */

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  "outerwear", "blazers", "tops", "shirts", "knitwear", "bottoms", "jeans",
  "shorts", "skirts", "dresses", "jumpsuits", "swimwear", "footwear", "bags", "accessories",
];
const GENDERS: Gender[] = ["women", "men", "unisex"];
/** The placeholder of a recipe's domain: data, the same in every language. */
const EXAMPLE = { domain: "example.com" } as const;
const RULE_FIELDS: ParserRuleField[] = [
  "name", "brand", "price", "currency", "image", "sizes", "color", "material", "description",
];

interface ConfigState {
  siteConfigs: ParserSiteConfig[];
  aiSettings: ParserAiSettings;
  openai: { configured: boolean };
}

type Tab = "recipes" | "ai";

// ── Tiny styled primitives (goo-studio recipes, DESIGN_SYSTEM.md §9) ─────────

/** The admin field without its size and fill, for the one variant the recipes lack. */
const fieldBase =
  "w-full rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";
const inputCls = `${INPUT} w-full`;
/** Regexes. */
const monoInputCls = `${fieldBase} font-mono text-[11px] bg-transparent`;
const selectCls = `${SELECT} w-full`;
/** Where the extension hands its pages to; install steps live there too. */
const EXTENSION_PAGE = "/goo-studio/parser/collect";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ParserPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("recipes");
  const [config, setConfig] = useState<ConfigState | null>(null);
  /** A dictionary key, so the message follows a language switch. */
  const [loadError, setLoadError] = useState<Key | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

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

      {/* The way in: everything a store sells comes through the extension. */}
      <div className={`${PANEL} px-5 py-4 mb-6 flex items-center gap-3 flex-wrap`}>
        <p className="flex-1 min-w-[220px] text-[13px] text-[var(--foreground)] leading-relaxed">
          {t("parser.ext.title")}
          <span className="block text-[12px] text-[var(--foreground-muted)]">
            {t("parser.ext.text")}
          </span>
        </p>
        <Link href={EXTENSION_PAGE} className={btn("primary")}>{t("parser.extension")}</Link>
      </div>

      <div className="mb-6">
        <Tabs
          label={t("parser.tabs")}
          idBase="parser"
          tabs={[
            { key: "recipes", label: t("parser.tab.recipes") },
            { key: "ai", label: t("parser.tab.ai") },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {loadError && <div className={`${BANNER.err} mb-4`}>{t(loadError)}</div>}

      {/* Both tabs stay mounted while hidden, so an unsaved draft survives a
          look at the other tab instead of vanishing with it. */}
      {config && (
        <div hidden={tab !== "recipes"} {...(tab === "recipes" ? tabPanel("parser", "recipes") : {})}>
          <RecipesTab config={config} onSaved={(c) => setConfig((s) => (s ? { ...s, siteConfigs: c } : s))} />
        </div>
      )}
      {config && (
        <div hidden={tab !== "ai"} {...(tab === "ai" ? tabPanel("parser", "ai") : {})}>
          <AiTab config={config} onSaved={(next) => setConfig(next)} />
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

// ── Shared bits ──────────────────────────────────────────────────────────────

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

/** A label and its one field. The label wraps the field, so it names it for screen readers and a click on it focuses it. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={FIELD_LABEL}>{label}</span>
      {children}
    </label>
  );
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
              <div key={c.id} className={PANEL}>
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

// ── AI & images tab ──────────────────────────────────────────────────────────

function AiTab({ config, onSaved }: { config: ConfigState; onSaved: (c: ConfigState) => void }) {
  const t = useT();
  const toast = useToast();
  const [ai, setAi] = useState<ParserAiSettings>(config.aiSettings);
  const [saving, setSaving] = useState(false);

  const dirty = stableJson(ai) !== stableJson(config.aiSettings);

  // The page's SaveBar saves and says how it went in a toast (DESIGN_SYSTEM.md §9).
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/parser/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiSettings: ai }),
      });
      const data = await res.json();
      if (!res.ok) { toast.err(data.error ?? t("parser.saveFailed")); return; }
      onSaved(data);
      // The server sanitises what it stores; show that, so the draft matches
      // the saved state instead of reading as unsaved.
      setAi(data.aiSettings);
      toast.ok(t("common.saved"));
    } catch {
      toast.err(t("common.networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <FormPanel>
        <FormSection
          id="parser-ai"
          title={t("parser.ai.title")}
          description={t("parser.ai.hint")}
          extra={
            config.openai.configured ? (
              <Badge tone="ok">{t("parser.ai.openaiFound")}</Badge>
            ) : (
              <Badge tone="warn">{t("parser.ai.openaiMissing")}</Badge>
            )
          }
        >
          <Toggle
            on={ai.enabled}
            disabled={!config.openai.configured}
            onChange={(v) => setAi((s) => ({ ...s, enabled: v }))}
            label={t("parser.ai.enabled")}
          />

          {ai.enabled && (
            <Field label={t("parser.ai.mode")}>
              <select className={selectCls} value={ai.mode} onChange={(e) => setAi((s) => ({ ...s, mode: e.target.value as ParserAiSettings["mode"] }))}>
                <option value="auto">{t("parser.ai.auto")}</option>
                <option value="always">{t("parser.ai.always")}</option>
              </select>
            </Field>
          )}

          <Toggle
            on={ai.downloadImages}
            onChange={(v) => setAi((s) => ({ ...s, downloadImages: v }))}
            label={t("parser.ai.downloadImages")}
          />
          <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed -mt-1">
            {t("parser.ai.downloadHint")}
          </p>
        </FormSection>
      </FormPanel>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setAi(config.aiSettings)} />
    </>
  );
}
