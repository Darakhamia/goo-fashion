"use client";

import { useState, useEffect } from "react";
import { SUPPORTED_STORES, storeFaviconUrl } from "@/lib/stores";
import { useBackdropDismiss } from "@/lib/use-backdrop-dismiss";
import EmbeddingsCard from "./EmbeddingsCard";
import { PRIMARY_BTN, SECONDARY_BTN, INPUT, Spinner, LoadingLine } from "./recipes";

interface KeyStatus {
  configured: boolean;
  source: "env" | "database" | null;
  maskedKey?: string;
}

// ── Homepage showcase ────────────────────────────────────────────────────────

type StepKey = "step1" | "step2" | "step3" | "step4";
type ShowcaseIds = Record<StepKey, string[]>;

interface PickerItem {
  id: string;
  name: string;
  imageUrl: string;
  sub: string; // brand (products) or occasion (outfits)
}

type StepSource = "products" | "outfits";

const STEP_META: { key: StepKey; n: string; title: string; hint: string; max: number; source: StepSource }[] = [
  { key: "step1", n: "01", title: "Choose items", hint: "One product — the large reference card.", max: 1, source: "products" },
  { key: "step2", n: "02", title: "Build your look", hint: "Up to 3 products scattered in the frame.", max: 3, source: "products" },
  { key: "step3", n: "03", title: "Generate preview", hint: "One generated look shown on the preview card.", max: 1, source: "outfits" },
  { key: "step4", n: "04", title: "Shop the look", hint: "Up to 3 products standing in the box.", max: 3, source: "products" },
];

const EMPTY_SHOWCASE: ShowcaseIds = { step1: [], step2: [], step3: [], step4: [] };

// ── AI Stylist showcase ──────────────────────────────────────────────────────

// An extra store added to the homepage "Where to buy" list (price as a string
// for the input; "" = no price).
interface ExtraStoreForm {
  name: string;
  price: string;
}

interface StylistIds {
  chatOutfits: string[];      // up to 2 outfits shown as cards in the chat
  featuredProduct: string | null; // product shown bottom-left with retailers
  extraStores: ExtraStoreForm[]; // stores added on top of the item's own retailers
}

const EMPTY_STYLIST: StylistIds = {
  chatOutfits: [],
  featuredProduct: null,
  extraStores: [],
};
const MAX_CHAT_LOOKS = 2;
const MAX_SHOWCASE_STORES = 6;

type StylistPickerKind = "chat" | "featured" | "stores";

/**
 * Where a saved selection is in loading. Until it is "ready" the editor has no
 * idea what is live, so Save stays off: saving the empty placeholder would
 * wipe the homepage selection.
 */
type LoadState = "loading" | "ready" | "error";

// ── Database schema check ────────────────────────────────────────────────────

interface SchemaCheck {
  table: string;
  column: string;
  migration: string;
  breaks: string;
  present: boolean;
  error?: string;
}

interface SchemaReport {
  ok: boolean;
  checks: SchemaCheck[];
  missingMigrations: string[];
}

/** Both catalog loaders can fail; keep both messages rather than the last. */
function appendMessage(prev: string, message: string): string {
  return prev ? `${prev} ${message}` : message;
}

/** A saved selection that did not load: say so, keep Save off, offer a retry. */
function SelectionLoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div>
      <p className="text-[11px] text-red-500 leading-relaxed">{message}</p>
      <p className="text-[11px] text-[var(--foreground-muted)] mt-1 leading-relaxed">
        Saving is off until the current selection loads, so the live homepage is not overwritten with an empty one.
      </p>
      <button onClick={onRetry} className={`mt-3 ${SECONDARY_BTN}`}>
        Retry
      </button>
    </div>
  );
}

/** A picked product/look as a small tile with a remove control. */
function SelectedThumb({
  id,
  item,
  fit,
  onRemove,
}: {
  id: string;
  item: PickerItem | undefined;
  fit: "contain" | "cover";
  onRemove: () => void;
}) {
  return (
    <div
      className="relative w-14 h-14 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface)] group"
      title={item?.name ?? id}
    >
      {item?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          decoding="async"
          className={`w-full h-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-[var(--foreground-subtle)] text-center px-1">
          missing
        </div>
      )}
      <button
        onClick={onRemove}
        // Revealed on hover where there is a pointer; touch screens have no
        // hover, so there it is always shown, and large enough to tap.
        className="absolute top-0.5 right-0.5 w-6 h-6 md:w-4 md:h-4 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        aria-label={`Remove ${item?.name ?? "item"}`}
      >
        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
          <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** The dashed "+" tile that opens a picker. */
function AddSlotButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-14 h-14 rounded-lg border border-dashed border-[var(--border-strong)] text-[var(--foreground-subtle)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors flex items-center justify-center"
      aria-label={label}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

interface PickerModalProps {
  title: string;
  /** What one item is called in the hint line: "product", "look", "store". */
  noun: string;
  items: PickerItem[];
  selectedIds: string[];
  max: number;
  onPick: (id: string) => void;
  onClose: () => void;
  searchPlaceholder: string;
  emptyText: string;
  fit?: "contain" | "cover";
  /** Pad the image inside its tile (store logos). */
  padded?: boolean;
  /** Shown in a tile with no image; defaults to the item's initials. */
  noImageText?: string;
}

/**
 * The one item picker every slot on this page opens. The search lives inside,
 * so each opening starts with an empty query.
 */
function PickerModal({
  title,
  noun,
  items,
  selectedIds,
  max,
  onPick,
  onClose,
  searchPlaceholder,
  emptyText,
  fit = "contain",
  padded = false,
  noImageText,
}: PickerModalProps) {
  const [query, setQuery] = useState("");
  // The panel has a search field; a selection dragged past its edge must not
  // close it.
  const backdrop = useBackdropDismiss(onClose);

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((p) => `${p.name} ${p.sub}`.toLowerCase().includes(q)) : items;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" {...backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl max-h-[90dvh] md:max-h-[80vh] flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--background)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">{title}</p>
            <p className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">
              {selectedIds.length}/{max} selected · click a {noun} to {max === 1 ? "choose" : "toggle"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto px-3 py-1.5 rounded-lg text-[11px] tracking-[0.12em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity"
          >
            Done
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[var(--border)] shrink-0">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className={`w-full ${INPUT}`}
          />
        </div>

        <div className="overflow-y-auto overscroll-contain p-4">
          {items.length === 0 ? (
            <p className="text-[11px] text-[var(--foreground-subtle)] text-center py-10">{emptyText}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const selected = selectedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => onPick(p.id)}
                    aria-pressed={selected}
                    className={`relative rounded-lg overflow-hidden border text-left transition-colors ${
                      selected ? "border-[var(--foreground)]" : "border-[var(--border)] hover:border-[var(--foreground-muted)]"
                    }`}
                  >
                    <div className="aspect-square bg-[var(--surface)] flex items-center justify-center">
                      {p.imageUrl ? (
                        // The catalogue can be hundreds of store-hosted photos:
                        // load only the ones scrolled into view.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className={`w-full h-full ${fit === "cover" ? "object-cover" : "object-contain"} ${padded ? "p-3" : ""}`}
                        />
                      ) : (
                        <span className="text-[13px] font-semibold text-[var(--foreground-subtle)]">
                          {noImageText ?? p.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center">
                        <svg width="9" height="9" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                          <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] font-medium text-[var(--foreground)] truncate">{p.name}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)] truncate capitalize">{p.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

  // ── Catalog for previews and pickers ──────────────────────────────────────
  const [products, setProducts] = useState<PickerItem[]>([]);
  const [outfits, setOutfits] = useState<PickerItem[]>([]);
  const [catalogError, setCatalogError] = useState("");

  // ── Homepage showcase state ───────────────────────────────────────────────
  const [showcase, setShowcase] = useState<ShowcaseIds>(EMPTY_SHOWCASE);
  const [showcaseLoad, setShowcaseLoad] = useState<LoadState>("loading");
  const [showcaseLoadError, setShowcaseLoadError] = useState("");
  const [pickerStep, setPickerStep] = useState<StepKey | null>(null);
  const [showcaseSaving, setShowcaseSaving] = useState(false);
  const [showcaseOk, setShowcaseOk] = useState(false);
  const [showcaseError, setShowcaseError] = useState("");

  // ── AI Stylist showcase state ─────────────────────────────────────────────
  const [stylist, setStylist] = useState<StylistIds>(EMPTY_STYLIST);
  const [stylistLoad, setStylistLoad] = useState<LoadState>("loading");
  const [stylistLoadError, setStylistLoadError] = useState("");
  const [stylistPicker, setStylistPicker] = useState<StylistPickerKind | null>(null);
  const [stylistSaving, setStylistSaving] = useState(false);
  const [stylistOk, setStylistOk] = useState(false);
  const [stylistError, setStylistError] = useState("");

  // ── Database schema state ─────────────────────────────────────────────────
  const [schema, setSchema] = useState<SchemaReport | null>(null);
  const [schemaError, setSchemaError] = useState("");
  const [schemaLoading, setSchemaLoading] = useState(false);

  useEffect(() => {
    loadShowcase();
    loadStylist();
    loadProducts();
    loadOutfits();
    loadStatus();
    loadSchema();
  }, []);

  async function loadSchema() {
    setSchemaLoading(true);
    setSchemaError("");
    try {
      const res = await fetch("/api/admin/schema-check", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setSchemaError(json?.error || `Check failed (${res.status})`);
        setSchema(null);
      } else {
        setSchema(json as SchemaReport);
      }
    } catch {
      setSchemaError("Could not reach the server.");
      setSchema(null);
    } finally {
      setSchemaLoading(false);
    }
  }

  // ── Stylist loaders / handlers ────────────────────────────────────────────

  async function loadStylist() {
    setStylistLoad("loading");
    setStylistLoadError("");
    try {
      const res = await fetch("/api/admin/homepage-stylist", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStylistLoadError(data?.error || `Could not load the saved stylist showcase (${res.status}).`);
        setStylistLoad("error");
        return;
      }
      // `extraStores` is current; legacy `stores`/`brands` were string[] names.
      const rawStores =
        data.extraStores ?? data.stores ?? data.brands ?? [];
      const extraStores: ExtraStoreForm[] = Array.isArray(rawStores)
        ? rawStores
            .map((s: unknown): ExtraStoreForm | null => {
              if (typeof s === "string") return { name: s, price: "" };
              if (s && typeof s === "object") {
                const name = (s as Record<string, unknown>).name;
                const price = (s as Record<string, unknown>).price;
                if (typeof name === "string") {
                  return { name, price: typeof price === "number" && price > 0 ? String(price) : "" };
                }
              }
              return null;
            })
            .filter((x: ExtraStoreForm | null): x is ExtraStoreForm => x !== null)
            // Only keep stores we integrate with; legacy brand entries are dropped.
            .filter((x: ExtraStoreForm) =>
              SUPPORTED_STORES.some((s) => s.name.toLowerCase() === x.name.trim().toLowerCase())
            )
            .slice(0, MAX_SHOWCASE_STORES)
        : [];
      setStylist({
        chatOutfits: Array.isArray(data.chatOutfits) ? data.chatOutfits.slice(0, 2) : [],
        featuredProduct: typeof data.featuredProduct === "string" ? data.featuredProduct : null,
        extraStores,
      });
      setStylistLoad("ready");
    } catch {
      setStylistLoadError("Could not reach the server to load the saved stylist showcase.");
      setStylistLoad("error");
    }
  }

  function toggleChatOutfit(id: string) {
    setStylistOk(false);
    setStylist((prev) => {
      if (prev.chatOutfits.includes(id)) {
        return { ...prev, chatOutfits: prev.chatOutfits.filter((x) => x !== id) };
      }
      return { ...prev, chatOutfits: [...prev.chatOutfits, id].slice(0, MAX_CHAT_LOOKS) };
    });
  }

  function setFeaturedProduct(id: string) {
    setStylistOk(false);
    setStylist((prev) => ({
      ...prev,
      featuredProduct: prev.featuredProduct === id ? null : id,
    }));
  }

  // Add a store (from the library picker) if not already present.
  function toggleShowcaseStore(name: string) {
    setStylistOk(false);
    setStylist((prev) => {
      if (prev.extraStores.some((s) => s.name === name)) {
        return { ...prev, extraStores: prev.extraStores.filter((s) => s.name !== name) };
      }
      return {
        ...prev,
        extraStores: [...prev.extraStores, { name, price: "" }].slice(0, MAX_SHOWCASE_STORES),
      };
    });
  }

  function removeShowcaseStore(name: string) {
    setStylistOk(false);
    setStylist((prev) => ({ ...prev, extraStores: prev.extraStores.filter((s) => s.name !== name) }));
  }

  function setShowcaseStorePrice(name: string, price: string) {
    setStylistOk(false);
    setStylist((prev) => ({
      ...prev,
      extraStores: prev.extraStores.map((s) => (s.name === name ? { ...s, price } : s)),
    }));
  }

  async function saveStylist() {
    if (stylistLoad !== "ready") return;
    setStylistSaving(true);
    setStylistError("");
    setStylistOk(false);
    try {
      const payload = {
        chatOutfits: stylist.chatOutfits,
        featuredProduct: stylist.featuredProduct,
        extraStores: stylist.extraStores.map((s) => ({
          name: s.name,
          price: parseFloat(s.price) > 0 ? parseFloat(s.price) : null,
        })),
      };
      const res = await fetch("/api/admin/homepage-stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setStylistError(json.error ?? "Save failed"); return; }
      setStylistOk(true);
      setTimeout(() => setStylistOk(false), 3000);
    } catch {
      setStylistError("Network error. Try again.");
    } finally {
      setStylistSaving(false);
    }
  }

  // ── Showcase loaders / handlers ───────────────────────────────────────────

  async function loadShowcase() {
    setShowcaseLoad("loading");
    setShowcaseLoadError("");
    try {
      const res = await fetch("/api/admin/homepage-showcase", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setShowcaseLoadError(data?.error || `Could not load the saved showcase (${res.status}).`);
        setShowcaseLoad("error");
        return;
      }
      setShowcase({
        step1: Array.isArray(data.step1) ? data.step1 : [],
        step2: Array.isArray(data.step2) ? data.step2 : [],
        step3: Array.isArray(data.step3) ? data.step3 : [],
        step4: Array.isArray(data.step4) ? data.step4 : [],
      });
      setShowcaseLoad("ready");
    } catch {
      setShowcaseLoadError("Could not reach the server to load the saved showcase.");
      setShowcaseLoad("error");
    }
  }

  // The catalog only feeds previews and pickers; a failure there does not risk
  // the saved selection, but the tiles would all read "missing" — so say why.
  async function loadProducts() {
    try {
      const res = await fetch("/api/products?raw=true");
      if (!res.ok) { setCatalogError((prev) => appendMessage(prev, `Products did not load (${res.status}).`)); return; }
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(
          data.map((p: { id: string; name: string; brand: string; imageUrl: string }) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
            sub: p.brand,
          }))
        );
      }
    } catch {
      setCatalogError((prev) => appendMessage(prev, "Products did not load (network error)."));
    }
  }

  async function loadOutfits() {
    try {
      const res = await fetch("/api/outfits");
      if (!res.ok) { setCatalogError((prev) => appendMessage(prev, `Looks did not load (${res.status}).`)); return; }
      const data = await res.json();
      if (Array.isArray(data)) {
        setOutfits(
          data.map((o: { id: string; name: string; occasion: string; imageUrl: string }) => ({
            id: o.id,
            name: o.name,
            imageUrl: o.imageUrl,
            sub: o.occasion ?? "look",
          }))
        );
      }
    } catch {
      setCatalogError((prev) => appendMessage(prev, "Looks did not load (network error)."));
    }
  }

  // Which catalog backs a given step, and a lookup within it.
  const itemsForStep = (step: StepKey) =>
    STEP_META.find((m) => m.key === step)!.source === "outfits" ? outfits : products;
  const lookupItem = (step: StepKey, id: string) => itemsForStep(step).find((p) => p.id === id);

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
    if (showcaseLoad !== "ready") return;
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
      const res = await fetch("/api/admin/settings?key=openai_api_key", { cache: "no-store" });
      if (res.status === 401) { setUnauthorized(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setLoadError(data?.error ? `Failed to load settings: ${data.error}` : "Failed to load settings."); return; }
      setStatus(data as KeyStatus);
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
    if (
      !confirm(
        "Remove the stored OpenAI API key?\n\nUntil a new key is added, these stop working: blog post generation, AI-written emails, AI extraction in the parser, bug reports, and the stylist's semantic search."
      )
    ) return;
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
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Settings</h1>
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

  // The key can be typed in whenever it is not managed by the environment:
  // straight away when there is none, after "Update" when there is one.
  const editingKey =
    status !== null && status.source !== "env" && (!status.configured || showInput);

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Settings</h1>
      <p className="text-xs text-[var(--foreground-muted)] mt-1 mb-8">
        Configure the homepage showcase and API keys.
      </p>

      {/* ── Database schema ──
          The app and its migrations deploy separately, and several write paths
          drop an unknown column rather than lose the row — so a migration that
          was never run costs a feature silently. This says out loud what the
          database actually has. */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] mb-6">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <ellipse cx="7" cy="3.5" rx="4.75" ry="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2.25 3.5V10.5C2.25 11.6 4.38 12.5 7 12.5C9.62 12.5 11.75 11.6 11.75 10.5V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M2.25 7C2.25 8.1 4.38 9 7 9C9.62 9 11.75 8.1 11.75 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
              Database schema
            </p>
          </div>
          <p className="text-[11px] text-[var(--foreground-muted)] mt-1.5 leading-relaxed">
            Tables and optional columns the code relies on. A missing column is never an error — the row saves without it — so the feature it carries just stops working quietly.
          </p>
        </div>

        <div className="px-5 py-4">
          {schemaLoading && !schema && <LoadingLine label="Checking…" />}

          {schemaError && <p className="text-[11px] text-red-500">{schemaError}</p>}

          {schema && (
            <>
              <span
                className={`inline-block px-2 py-1 rounded-lg text-[10px] tracking-[0.18em] uppercase border ${
                  schema.ok
                    ? "bg-emerald-400/15 text-emerald-500 border-emerald-400/30"
                    : "bg-amber-400/15 text-amber-500 border-amber-400/30"
                }`}
              >
                {schema.ok ? "All columns present" : `${schema.checks.filter((c) => !c.present).length} missing`}
              </span>

              <ul className="mt-3 space-y-2">
                {schema.checks.map((c) => (
                  <li key={`${c.table}.${c.column}`} className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        c.present ? "bg-emerald-500" : c.error ? "bg-red-500" : "bg-amber-500"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] text-[var(--foreground)] font-mono">
                        {c.table}.{c.column}
                      </p>
                      {!c.present && (
                        <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed">
                          {c.error ? c.error : `${c.breaks} Run ${c.migration}.`}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {schema.missingMigrations.length > 0 && (
                <p className="text-[11px] text-[var(--foreground-muted)] mt-3 leading-relaxed">
                  Run, in order (numbered files are in <span className="font-mono">supabase/migrations/</span>,{" "}
                  <span className="font-mono">supabase-schema.sql</span> is at the repo root):{" "}
                  <span className="font-mono text-[var(--foreground)]">
                    {schema.missingMigrations.join(", ")}
                  </span>
                </p>
              )}
            </>
          )}

          {/* Re-check stays reachable after a failed check too — that is when
              it is needed. */}
          {(schema || schemaError) && (
            <button onClick={loadSchema} disabled={schemaLoading} className={`mt-4 ${PRIMARY_BTN}`}>
              {schemaLoading ? "Checking…" : "Re-check"}
            </button>
          )}
        </div>
      </div>

      {catalogError && (
        <p className="text-[11px] text-red-500 mb-4 leading-relaxed">
          {catalogError} Previews below may read “missing” and the pickers may be empty; saved selections are not affected.
        </p>
      )}

      {/* ── Homepage showcase ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] mb-6">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
          {showcaseLoad === "loading" && <LoadingLine label="Loading the saved showcase…" />}
          {showcaseLoad === "error" && (
            <SelectionLoadFailed message={showcaseLoadError} onRetry={loadShowcase} />
          )}
          {showcaseLoad === "ready" && STEP_META.map((meta) => (
            <div key={meta.key}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                <span className="font-mono text-[10px] text-[var(--foreground-subtle)] tabular-nums">{meta.n}</span>
                <span className="text-[12px] font-medium text-[var(--foreground)]">{meta.title}</span>
                <span className="text-[10px] text-[var(--foreground-subtle)] ml-auto">{meta.hint}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {showcase[meta.key].map((id) => (
                  <SelectedThumb
                    key={id}
                    id={id}
                    item={lookupItem(meta.key, id)}
                    fit="contain"
                    onRemove={() => removeItem(meta.key, id)}
                  />
                ))}

                {showcase[meta.key].length < meta.max && (
                  <AddSlotButton
                    label={`Add product to ${meta.title}`}
                    onClick={() => setPickerStep(meta.key)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--border)] flex flex-wrap items-center gap-3">
          <button
            onClick={saveShowcase}
            disabled={showcaseSaving || showcaseLoad !== "ready"}
            className={PRIMARY_BTN}
          >
            {showcaseSaving && <Spinner />}
            {showcaseSaving ? "Saving…" : "Save showcase"}
          </button>
          {showcaseOk && <p className="text-[11px] text-emerald-500">Saved — changes go live on next homepage load.</p>}
          {showcaseError && <p className="text-[11px] text-red-500">{showcaseError}</p>}
        </div>
      </div>

      {/* ── AI Stylist showcase ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] mb-6">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1.5l1.1 3 3.2.2-2.5 2 .8 3.1L7 8.3 4.4 9.8l.8-3.1-2.5-2 3.2-.2L7 1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
            <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)]">
              AI Stylist showcase
            </p>
          </div>
          <p className="text-[11px] text-[var(--foreground-muted)] mt-1.5 leading-relaxed">
            Controls the “Your style. Found by AI.” section. Pick up to two looks shown as
            cards in the chat preview, and one product featured below with its “Where to buy”
            list. Empty slots fall back to the latest catalog items.
          </p>
        </div>

        <div className="px-5 py-4 space-y-5">
          {stylistLoad === "loading" && <LoadingLine label="Loading the saved stylist showcase…" />}
          {stylistLoad === "error" && (
            <SelectionLoadFailed message={stylistLoadError} onRetry={loadStylist} />
          )}
          {stylistLoad === "ready" && (
            <>
              {/* Chat looks */}
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                  <span className="text-[12px] font-medium text-[var(--foreground)]">Chat looks</span>
                  <span className="text-[10px] text-[var(--foreground-subtle)] ml-auto">
                    Up to {MAX_CHAT_LOOKS} outfits shown inside the chat.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {stylist.chatOutfits.map((id) => (
                    <SelectedThumb
                      key={id}
                      id={id}
                      item={outfits.find((x) => x.id === id)}
                      fit="cover"
                      onRemove={() => toggleChatOutfit(id)}
                    />
                  ))}
                  {stylist.chatOutfits.length < MAX_CHAT_LOOKS && (
                    <AddSlotButton label="Add a chat look" onClick={() => setStylistPicker("chat")} />
                  )}
                </div>
              </div>

              {/* Featured product */}
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                  <span className="text-[12px] font-medium text-[var(--foreground)]">Featured product</span>
                  <span className="text-[10px] text-[var(--foreground-subtle)] ml-auto">
                    Shown bottom-left with its retailers.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {stylist.featuredProduct ? (
                    <SelectedThumb
                      id={stylist.featuredProduct}
                      item={products.find((x) => x.id === stylist.featuredProduct)}
                      fit="contain"
                      onRemove={() => setFeaturedProduct(stylist.featuredProduct!)}
                    />
                  ) : (
                    <AddSlotButton label="Add the featured product" onClick={() => setStylistPicker("featured")} />
                  )}
                </div>
              </div>

              {/* Stores shown in "Where to buy" */}
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
                  <span className="text-[12px] font-medium text-[var(--foreground)]">Where to buy — extra stores</span>
                  <span className="text-[10px] text-[var(--foreground-subtle)] ml-auto">
                    Up to {MAX_SHOWCASE_STORES}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--foreground-subtle)] mb-3 leading-relaxed">
                  The item’s own stores (and prices) always show automatically. Add extra stores here —
                  the logo and store link are pulled from the library; set an optional price tag for each.
                  Clicking a row opens that store’s link.
                </p>

                <div className="flex flex-col gap-2">
                  {stylist.extraStores.map(({ name, price }) => {
                    const store = SUPPORTED_STORES.find(
                      (x) => x.name.toLowerCase() === name.toLowerCase()
                    );
                    return (
                      <div
                        key={name}
                        className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                      >
                        <span className="w-8 h-8 rounded-lg bg-white border border-[var(--border)] overflow-hidden flex items-center justify-center shrink-0">
                          {store ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={storeFaviconUrl(store.domain)}
                              alt={name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <span className="text-[10px] font-semibold text-[var(--foreground-subtle)]">
                              {name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="text-[12px] text-[var(--foreground)] flex-1 truncate" title={name}>{name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] text-[var(--foreground-subtle)]">$</span>
                          <input
                            type="number"
                            min="0"
                            value={price}
                            onChange={(e) => setShowcaseStorePrice(name, e.target.value)}
                            placeholder="Price"
                            aria-label={`Price at ${name}`}
                            className={`w-24 ${INPUT}`}
                          />
                        </div>
                        <button
                          onClick={() => removeShowcaseStore(name)}
                          className="w-5 h-5 rounded-full hover:bg-[var(--background)] text-[var(--foreground-subtle)] hover:text-red-500 flex items-center justify-center transition-colors shrink-0"
                          aria-label={`Remove ${name}`}
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                            <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  {stylist.extraStores.length < MAX_SHOWCASE_STORES && (
                    <button
                      onClick={() => setStylistPicker("stores")}
                      className="self-start h-8 px-3 rounded-lg border border-dashed border-[var(--border-strong)] text-[11px] text-[var(--foreground-subtle)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5"
                      aria-label="Add a store"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      Add store
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--border)] flex flex-wrap items-center gap-3">
          <button
            onClick={saveStylist}
            disabled={stylistSaving || stylistLoad !== "ready"}
            className={PRIMARY_BTN}
          >
            {stylistSaving && <Spinner />}
            {stylistSaving ? "Saving…" : "Save stylist"}
          </button>
          {stylistOk && <p className="text-[11px] text-emerald-500">Saved — changes go live on next homepage load.</p>}
          {stylistError && <p className="text-[11px] text-red-500">{stylistError}</p>}
        </div>
      </div>

      {/* ── OpenAI section ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
            Shared key for everything on the site that calls OpenAI: blog post generation, AI-written emails,
            AI extraction in the parser, bug reports and the stylist&apos;s semantic search. The AI Stylist chat itself
            runs on Replicate and does not use it. Stored server-side and never sent to the browser.
          </p>
        </div>

        {/* Status body */}
        <div className="px-5 py-4">

          {/* Loading */}
          {status === null && !loadError && <LoadingLine label="Loading…" />}

          {/* Load error */}
          {loadError && (
            <div>
              <p className="text-[11px] text-red-500">{loadError}</p>
              <button onClick={loadStatus} className={`mt-3 ${SECONDARY_BTN}`}>
                Retry
              </button>
            </div>
          )}

          {/* Not configured */}
          {status && !status.configured && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[var(--border-strong)]" />
                <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)]">
                  Not configured
                </p>
              </div>
              <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed">
                Off until a key is added: blog post generation, AI-written emails, AI extraction in the parser,
                bug reports and the stylist&apos;s semantic search.
              </p>
            </div>
          )}

          {/* Configured — env source */}
          {status?.configured && status.source === "env" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
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
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
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
                <p className="text-[11px] text-emerald-500 mb-3">Key saved successfully.</p>
              )}
            </div>
          )}

          {/* Input form — add or update */}
          {editingKey && (
            <div>
              {status?.configured && (
                <p className="text-[11px] text-[var(--foreground-muted)] mb-3">
                  Enter a new key to replace the current one.
                </p>
              )}
              <label
                htmlFor="openai-key-input"
                className="block text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2"
              >
                {status?.configured ? "New API Key" : "API Key"}
              </label>
              <div className="relative">
                <input
                  id="openai-key-input"
                  type={showRaw ? "text" : "password"}
                  value={inputKey}
                  onChange={(e) => { setInputKey(e.target.value); setSaveError(""); }}
                  placeholder="sk-proj-..."
                  spellCheck={false}
                  autoComplete="off"
                  className={`w-full pr-10 md:pr-9 font-mono ${INPUT}`}
                />
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  aria-label={showRaw ? "Hide key" : "Show key"}
                  className="absolute right-0 md:right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 md:w-auto md:h-auto flex items-center justify-center text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                >
                  {showRaw ? (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M2 2L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  )}
                </button>
              </div>
              {saveError && (
                <p className="text-[11px] text-red-500 mt-2">{saveError}</p>
              )}
            </div>
          )}

          {/* Test result */}
          {testResult === "ok" && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-500">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Key is valid — OpenAI API responded successfully
            </div>
          )}
          {testResult === "fail" && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-red-500">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
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

            {/* Save — whenever the key can be typed in */}
            {editingKey && (
              <button
                onClick={saveKey}
                disabled={!inputKey.trim() || saving}
                className={PRIMARY_BTN}
              >
                {saving && <Spinner />}
                {saving ? "Saving…" : "Save Key"}
              </button>
            )}

            {/* Cancel — only shown in update mode (key already configured) */}
            {editingKey && status.configured && (
              <button
                onClick={() => { setShowInput(false); setInputKey(""); setSaveError(""); }}
                className={SECONDARY_BTN}
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
                  className={SECONDARY_BTN}
                >
                  {testing && <Spinner />}
                  {testing ? "Testing…" : "Test Key"}
                </button>

                {/* Update key — only for database-stored keys */}
                {status.source === "database" && (
                  <button
                    onClick={() => { setShowInput(true); setTestResult(null); }}
                    className={SECONDARY_BTN}
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
                className="ml-auto text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {clearing ? "Clearing…" : "Clear"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Embeddings ── */}
      <EmbeddingsCard />

      {/* ── Pickers ── */}
      {pickerStep && (() => {
        const meta = STEP_META.find((m) => m.key === pickerStep)!;
        const isLooks = meta.source === "outfits";
        return (
          <PickerModal
            title={`${meta.n} · ${meta.title}`}
            noun={isLooks ? "look" : "product"}
            items={itemsForStep(pickerStep)}
            selectedIds={showcase[pickerStep]}
            max={meta.max}
            onPick={(id) => toggleItem(pickerStep, id)}
            onClose={() => setPickerStep(null)}
            searchPlaceholder={isLooks ? "Search looks by name…" : "Search by name or brand…"}
            emptyText={isLooks ? "No generated looks yet." : "No products found."}
          />
        );
      })()}

      {stylistPicker === "chat" && (
        <PickerModal
          title="Chat looks"
          noun="look"
          items={outfits}
          selectedIds={stylist.chatOutfits}
          max={MAX_CHAT_LOOKS}
          onPick={toggleChatOutfit}
          onClose={() => setStylistPicker(null)}
          searchPlaceholder="Search looks by name…"
          emptyText="No outfits yet."
          fit="cover"
        />
      )}
      {stylistPicker === "featured" && (
        <PickerModal
          title="Featured product"
          noun="product"
          items={products}
          selectedIds={stylist.featuredProduct ? [stylist.featuredProduct] : []}
          max={1}
          onPick={setFeaturedProduct}
          onClose={() => setStylistPicker(null)}
          searchPlaceholder="Search by name or brand…"
          emptyText="No products found."
        />
      )}
      {stylistPicker === "stores" && (
        <PickerModal
          title="Stores (Where to buy)"
          noun="store"
          items={SUPPORTED_STORES.map((s) => ({ id: s.name, name: s.name, imageUrl: storeFaviconUrl(s.domain), sub: "store" }))}
          selectedIds={stylist.extraStores.map((s) => s.name)}
          max={MAX_SHOWCASE_STORES}
          onPick={toggleShowcaseStore}
          onClose={() => setStylistPicker(null)}
          searchPlaceholder="Search stores…"
          emptyText="No stores available."
          padded
          noImageText="No logo"
        />
      )}
    </div>
  );
}
