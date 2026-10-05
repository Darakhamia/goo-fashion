"use client";

import { useState, useEffect } from "react";
import { SUPPORTED_STORES, storeFaviconUrl } from "@/lib/stores";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { AdminPage, SectionNav, useScrollSpy } from "@/components/admin/AdminPage";
import { FormPanel, FormSection } from "@/components/admin/FormSection";
import { SaveBar } from "@/components/admin/SaveBar";
import { Badge } from "@/components/admin/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { btn, BTN_ICON, FIELD_LABEL, INPUT } from "../_ui/recipes";
import { useT, type Key, type T } from "../_i18n";
import EmbeddingsCard from "./EmbeddingsCard";
import { Spinner, LoadingLine, sayFailure, withSlots, type Failure } from "./recipes";
import { Modal } from "@/components/admin/Modal";

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

// Each step is named after its card in the homepage's "How it works"; title
// and hint are dictionary keys, read at render.
const STEP_META: { key: StepKey; n: string; title: Key; hint: Key; max: number; source: StepSource }[] = [
  { key: "step1", n: "01", title: "settings.step.step1", hint: "settings.step.step1.hint", max: 1, source: "products" },
  { key: "step2", n: "02", title: "settings.step.step2", hint: "settings.step.step2.hint", max: 3, source: "products" },
  { key: "step3", n: "03", title: "settings.step.step3", hint: "settings.step.step3.hint", max: 1, source: "outfits" },
  { key: "step4", n: "04", title: "settings.step.step4", hint: "settings.step.step4.hint", max: 3, source: "products" },
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

function renderSchemaCheck(c: SchemaCheck, t: T) {
  return (
    <li key={`${c.table}.${c.column}`} className="flex items-start gap-2">
      <span
        className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
          c.present ? "bg-[var(--ok)]" : c.error ? "bg-[var(--err)]" : "bg-[var(--warn)]"
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--foreground)] font-mono">
          {c.table}.{c.column}
        </p>
        {!c.present && (
          <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed">
            {/* What breaks comes from the server, in English. */}
            {c.error ? c.error : `${c.breaks} ${t("settings.schema.run", { migration: c.migration })}`}
          </p>
        )}
      </div>
    </li>
  );
}

// Occasions the Outfits screen names in the dictionary; anything else shows as it is.
const OCCASION_KEY = new Map<string, Key>([
  ["casual", "outfits.occasion.casual"],
  ["work", "outfits.occasion.work"],
  ["evening", "outfits.occasion.evening"],
  ["sport", "outfits.occasion.sport"],
  ["formal", "outfits.occasion.formal"],
  ["weekend", "outfits.occasion.weekend"],
]);

/** A saved selection that did not load: say so, keep Save off, offer a retry. */
function SelectionLoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div>
      <p className="text-[11px] text-[var(--err)] leading-relaxed">{message}</p>
      <p className="text-[11px] text-[var(--foreground-muted)] mt-1 leading-relaxed">{t("settings.selection.saveOff")}</p>
      <button onClick={onRetry} className={`mt-3 ${btn("secondary")}`}>
        {t("common.retry")}
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
  const t = useT();
  return (
    <div
      className="relative w-14 h-14 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--background)] group"
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
        <div className="w-full h-full flex items-center justify-center text-[12px] text-[var(--foreground-subtle)] text-center px-1">
          {t("settings.thumb.missing")}
        </div>
      )}
      <button
        onClick={onRemove}
        // Revealed on hover where there is a pointer; touch screens have no
        // hover, so there it is always shown, and large enough to tap.
        className="absolute top-0.5 right-0.5 w-6 h-6 md:w-4 md:h-4 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        aria-label={item?.name ? t("settings.thumb.remove", { name: item.name }) : t("settings.thumb.removeUnnamed")}
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

type PickerNoun = "product" | "look" | "store";

/** The hint line of a picker: choosing one item, or adding and removing several. */
const PICK_HINT: Record<PickerNoun, { one: Key; many: Key }> = {
  product: { one: "settings.picker.chooseProduct", many: "settings.picker.toggleProduct" },
  look: { one: "settings.picker.chooseLook", many: "settings.picker.toggleLook" },
  store: { one: "settings.picker.chooseStore", many: "settings.picker.toggleStore" },
};

interface PickerModalProps {
  title: string;
  /** What one item is called in the hint line. */
  noun: PickerNoun;
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
  const t = useT();
  const [query, setQuery] = useState("");
  // The panel has a search field; a selection dragged past its edge must not
  // close it.

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((p) => `${p.name} ${p.sub}`.toLowerCase().includes(q)) : items;

  return (
    <Modal
      onClose={onClose}
      label={title}
      panelClassName="w-full max-w-2xl max-h-[90dvh] md:max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3 shrink-0">
        <div className="min-w-0">
          <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">{title}</p>
          <p className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">
            {t("settings.picker.count", { selected: selectedIds.length, max })} ·{" "}
            {t(max === 1 ? PICK_HINT[noun].one : PICK_HINT[noun].many)}
          </p>
        </div>
        <button
          onClick={onClose}
          className={`ml-auto ${btn("primary")}`}
        >
          {t("settings.picker.done")}
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
                  <div className="aspect-square bg-[var(--background)] flex items-center justify-center">
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
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--foreground)] text-[var(--surface)] flex items-center justify-center">
                      <svg width="9" height="9" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                        <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                  <div className="px-2 py-1.5">
                    <p className="text-[12px] font-medium text-[var(--foreground)] truncate">{p.name}</p>
                    <p className="text-[12px] text-[var(--foreground-subtle)] truncate capitalize">{p.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

const SECTION_IDS = ["schema", "showcase", "stylist", "openai", "embeddings"];

/** The shape of an OpenAI project key, as the key field's example. */
const KEY_PLACEHOLDER = "sk-proj-...";

export default function SettingsPage() {
  const t = useT();
  const confirm = useConfirm();
  const toast = useToast();
  const currentSection = useScrollSpy(SECTION_IDS);
  const schemaHelp = useHelp("settings-schema");
  const showcaseHelp = useHelp("settings-showcase");
  const stylistHelp = useHelp("settings-stylist");
  const storesHelp = useHelp("settings-stylist-stores");
  const openaiHelp = useHelp("settings-openai");

  // ── OpenAI key state ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [loadError, setLoadError] = useState<Failure>("");
  const [unauthorized, setUnauthorized] = useState(false);

  const [inputKey, setInputKey] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [saveError, setSaveError] = useState<Failure>("");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [testError, setTestError] = useState<Failure>("");

  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<Failure>("");

  // ── Catalog for previews and pickers ──────────────────────────────────────
  const [products, setProducts] = useState<PickerItem[]>([]);
  const [outfits, setOutfits] = useState<PickerItem[]>([]);
  /** Both catalog loaders can fail; keep both messages rather than the last. */
  const [catalogErrors, setCatalogErrors] = useState<Failure[]>([]);

  // ── Homepage showcase state ───────────────────────────────────────────────
  const [showcase, setShowcase] = useState<ShowcaseIds>(EMPTY_SHOWCASE);
  /** What is live: the last loaded or saved copy, for the SaveBar to compare with. */
  const [savedShowcase, setSavedShowcase] = useState<ShowcaseIds>(EMPTY_SHOWCASE);
  const [showcaseLoad, setShowcaseLoad] = useState<LoadState>("loading");
  const [showcaseLoadError, setShowcaseLoadError] = useState<Failure>("");
  const [pickerStep, setPickerStep] = useState<StepKey | null>(null);
  const [showcaseError, setShowcaseError] = useState<Failure>("");

  // ── AI Stylist showcase state ─────────────────────────────────────────────
  const [stylist, setStylist] = useState<StylistIds>(EMPTY_STYLIST);
  const [savedStylist, setSavedStylist] = useState<StylistIds>(EMPTY_STYLIST);
  const [stylistLoad, setStylistLoad] = useState<LoadState>("loading");
  const [stylistLoadError, setStylistLoadError] = useState<Failure>("");
  const [stylistPicker, setStylistPicker] = useState<StylistPickerKind | null>(null);
  const [stylistError, setStylistError] = useState<Failure>("");
  /** The SaveBar's one save is running. */
  const [savingAll, setSavingAll] = useState(false);

  // ── Database schema state ─────────────────────────────────────────────────
  const [schema, setSchema] = useState<SchemaReport | null>(null);
  const [schemaError, setSchemaError] = useState<Failure>("");
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
        setSchemaError(json?.error || { key: "settings.schema.checkFailed", vars: { status: res.status } });
        setSchema(null);
      } else {
        setSchema(json as SchemaReport);
      }
    } catch {
      setSchemaError({ key: "settings.unreachable" });
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
        setStylistLoadError(data?.error || { key: "settings.stylist.loadFailed", vars: { status: res.status } });
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
      const loaded: StylistIds = {
        chatOutfits: Array.isArray(data.chatOutfits) ? data.chatOutfits.slice(0, 2) : [],
        featuredProduct: typeof data.featuredProduct === "string" ? data.featuredProduct : null,
        extraStores,
      };
      setStylist(loaded);
      setSavedStylist(loaded);
      setStylistLoad("ready");
    } catch {
      setStylistLoadError({ key: "settings.stylist.loadFailedNetwork" });
      setStylistLoad("error");
    }
  }

  function toggleChatOutfit(id: string) {
    setStylist((prev) => {
      if (prev.chatOutfits.includes(id)) {
        return { ...prev, chatOutfits: prev.chatOutfits.filter((x) => x !== id) };
      }
      return { ...prev, chatOutfits: [...prev.chatOutfits, id].slice(0, MAX_CHAT_LOOKS) };
    });
  }

  function setFeaturedProduct(id: string) {
    setStylist((prev) => ({
      ...prev,
      featuredProduct: prev.featuredProduct === id ? null : id,
    }));
  }

  // Add a store (from the library picker) if not already present.
  function toggleShowcaseStore(name: string) {
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
    setStylist((prev) => ({ ...prev, extraStores: prev.extraStores.filter((s) => s.name !== name) }));
  }

  function setShowcaseStorePrice(name: string, price: string) {
    setStylist((prev) => ({
      ...prev,
      extraStores: prev.extraStores.map((s) => (s.name === name ? { ...s, price } : s)),
    }));
  }

  /** Saves the stylist showcase; true when it is live. */
  async function saveStylist(): Promise<boolean> {
    if (stylistLoad !== "ready") return false;
    setStylistError("");
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
      if (!res.ok) { setStylistError(json.error ?? { key: "settings.saveFailed" }); return false; }
      setSavedStylist(stylist);
      return true;
    } catch {
      setStylistError({ key: "settings.networkRetry" });
      return false;
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
        setShowcaseLoadError(data?.error || { key: "settings.showcase.loadFailed", vars: { status: res.status } });
        setShowcaseLoad("error");
        return;
      }
      const loaded: ShowcaseIds = {
        step1: Array.isArray(data.step1) ? data.step1 : [],
        step2: Array.isArray(data.step2) ? data.step2 : [],
        step3: Array.isArray(data.step3) ? data.step3 : [],
        step4: Array.isArray(data.step4) ? data.step4 : [],
      };
      setShowcase(loaded);
      setSavedShowcase(loaded);
      setShowcaseLoad("ready");
    } catch {
      setShowcaseLoadError({ key: "settings.showcase.loadFailedNetwork" });
      setShowcaseLoad("error");
    }
  }

  // The catalog only feeds previews and pickers; a failure there does not risk
  // the saved selection, but the tiles would all read "missing" — so say why.
  async function loadProducts() {
    try {
      const res = await fetch("/api/products?raw=true");
      if (!res.ok) {
        setCatalogErrors((prev) => [...prev, { key: "settings.catalog.productsFailed", vars: { status: res.status } }]);
        return;
      }
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
      setCatalogErrors((prev) => [...prev, { key: "settings.catalog.productsFailedNetwork" }]);
    }
  }

  async function loadOutfits() {
    try {
      const res = await fetch("/api/outfits");
      if (!res.ok) {
        setCatalogErrors((prev) => [...prev, { key: "settings.catalog.looksFailed", vars: { status: res.status } }]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setOutfits(
          data.map((o: { id: string; name: string; occasion: string; imageUrl: string }) => ({
            id: o.id,
            name: o.name,
            imageUrl: o.imageUrl,
            sub: o.occasion ?? "",
          }))
        );
      }
    } catch {
      setCatalogErrors((prev) => [...prev, { key: "settings.catalog.looksFailedNetwork" }]);
    }
  }

  // Looks as the pickers show them: the occasion in the admin's language, or
  // just "look" when there is none.
  const lookItems = outfits.map((o) => {
    const occasion = OCCASION_KEY.get(o.sub);
    return { ...o, sub: occasion ? t(occasion) : o.sub || t("settings.picker.look") };
  });

  // Which catalog backs a given step, and a lookup within it.
  const itemsForStep = (step: StepKey) =>
    STEP_META.find((m) => m.key === step)!.source === "outfits" ? lookItems : products;
  const lookupItem = (step: StepKey, id: string) => itemsForStep(step).find((p) => p.id === id);

  function toggleItem(step: StepKey, id: string) {
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
    setShowcase((prev) => ({ ...prev, [step]: prev[step].filter((x) => x !== id) }));
  }

  /** Saves the homepage showcase; true when it is live. */
  async function saveShowcase(): Promise<boolean> {
    if (showcaseLoad !== "ready") return false;
    setShowcaseError("");
    try {
      const res = await fetch("/api/admin/homepage-showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(showcase),
      });
      const json = await res.json();
      if (!res.ok) { setShowcaseError(json.error ?? { key: "settings.saveFailed" }); return false; }
      setSavedShowcase(showcase);
      return true;
    } catch {
      setShowcaseError({ key: "settings.networkRetry" });
      return false;
    }
  }

  // ── Load key status on mount ──────────────────────────────────────────────

  async function loadStatus() {
    setLoadError("");
    try {
      const res = await fetch("/api/admin/settings?key=openai_api_key", { cache: "no-store" });
      if (res.status === 401) { setUnauthorized(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(
          data?.error
            ? { key: "settings.openai.loadFailedWith", vars: { error: String(data.error) } }
            : { key: "settings.openai.loadFailed" }
        );
        return;
      }
      setStatus(data as KeyStatus);
    } catch {
      setLoadError({ key: "settings.openai.loadFailedNetwork" });
    }
  }

  // ── Save new key ──────────────────────────────────────────────────────────
  /** Saves the typed key; true when it is stored. */
  async function saveKey(): Promise<boolean> {
    const value = inputKey.trim();
    if (!value) return false;
    setSaveError("");
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "openai_api_key", value }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? { key: "settings.saveFailed" }); return false; }
      setStatus({ configured: true, source: "database", maskedKey: json.maskedKey });
      setInputKey("");
      setShowInput(false);
      return true;
    } catch {
      setSaveError({ key: "settings.networkRetry" });
      return false;
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
      if (!json.ok) setTestError(json.error ?? { key: "settings.openai.testFailed" });
    } catch {
      setTestResult("fail");
      setTestError({ key: "common.networkError" });
    } finally {
      setTesting(false);
    }
  }

  // ── Clear key ─────────────────────────────────────────────────────────────
  async function clearKey() {
    if (
      !(await confirm({
        title: t("settings.openai.clearConfirm"),
        body: t("settings.openai.clearConfirmBody"),
        confirmLabel: t("settings.openai.clearConfirmAction"),
        tone: "danger",
      }))
    ) return;
    setClearing(true);
    setClearError("");
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings?key=openai_api_key", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setClearError(json.error ?? { key: "settings.openai.clearFailed" });
        return;
      }
      setStatus({ configured: false, source: null });
      setShowInput(false);
    } catch {
      setClearError({ key: "settings.networkRetry" });
    } finally {
      setClearing(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (unauthorized) {
    return (
      <AdminPage layout="form">
        <PageHeader title={t("nav.settings")} />
        <div className="rounded-xl border border-[var(--border)] px-5 py-4">
          <p className="text-[12px] text-[var(--foreground-muted)] leading-relaxed">{t("settings.denied")}</p>
          <p className="text-[11px] text-[var(--foreground-subtle)] mt-2 leading-relaxed">
            {withSlots(t("settings.deniedHint"), {
              env: <code className="font-mono text-[11px]">{"ADMIN_USER_IDS"}</code>,
            })}
          </p>
        </div>
      </AdminPage>
    );
  }

  // The key can be typed in whenever it is not managed by the environment:
  // straight away when there is none, after "Update" when there is one.
  const editingKey =
    status !== null && status.source !== "env" && (!status.configured || showInput);

  // ── One Save for the page (GS4-5) ─────────────────────────────────────────
  // The homepage selections and a new key are saved together from the
  // SaveBar; what is unsaved is told apart from what is live by comparing
  // with the last loaded or saved copy.
  const showcaseDirty = showcaseLoad === "ready" && JSON.stringify(showcase) !== JSON.stringify(savedShowcase);
  const stylistDirty = stylistLoad === "ready" && JSON.stringify(stylist) !== JSON.stringify(savedStylist);
  const keyDirty = editingKey && inputKey.trim() !== "";
  const dirty = showcaseDirty || stylistDirty || keyDirty;

  async function saveAll() {
    setSavingAll(true);
    const results: boolean[] = [];
    if (showcaseDirty) results.push(await saveShowcase());
    if (stylistDirty) results.push(await saveStylist());
    if (keyDirty) results.push(await saveKey());
    setSavingAll(false);
    if (results.every(Boolean)) {
      toast.ok(showcaseDirty || stylistDirty ? t("settings.savedHomepage") : t("common.saved"));
    } else {
      toast.err(t("settings.savePartial"));
    }
  }

  function discardAll() {
    setShowcase(savedShowcase);
    setStylist(savedStylist);
    setShowcaseError("");
    setStylistError("");
    setInputKey("");
    setSaveError("");
    if (status?.configured) setShowInput(false);
  }

  const missingColumns = schema ? schema.checks.filter((c) => !c.present).length : 0;

  return (
    <AdminPage
      layout="form"
      nav={
        <SectionNav
          label={t("settings.nav")}
          current={currentSection}
          items={[
            { id: "schema", label: t("settings.nav.schema"), badge: missingColumns ? <Badge tone="warn">{missingColumns}</Badge> : undefined },
            { id: "showcase", label: t("settings.showcase.title") },
            { id: "stylist", label: t("settings.stylist.title") },
            { id: "openai", label: t("settings.nav.openai") },
            { id: "embeddings", label: t("settings.embed.title") },
          ]}
        />
      }
    >
      <PageHeader title={t("nav.settings")} subtitle={t("settings.subtitle")} />

      <FormPanel>
        {/* ── Database schema ──
            The app and its migrations deploy separately, and several write paths
            drop an unknown column rather than lose the row — so a migration that
            was never run costs a feature silently. This says out loud what the
            database actually has. */}
        <FormSection
          id="schema"
          title={t("settings.schema.title")}
          description={t("settings.schema.description")}
          extra={<HelpButton help={schemaHelp} label={t("settings.schema.helpLabel")} />}
        >
          {schemaHelp.open && (
            <HelpPanel help={schemaHelp}>
              <p>{t("settings.schema.help")}</p>
            </HelpPanel>
          )}
          <div>
          {schemaLoading && !schema && <LoadingLine label={t("settings.checking")} />}

          {schemaError && <p className="text-[11px] text-[var(--err)]">{sayFailure(schemaError, t)}</p>}

          {schema && (
            <>
              <Badge tone={schema.ok ? "ok" : "warn"}>
                {schema.ok
                  ? t("settings.schema.allPresent", { count: schema.checks.length })
                  : t("settings.schema.missing", { count: missingColumns })}
              </Badge>

              {/* What needs doing comes first; the columns that are fine fold
                  away, so the card is one line when the database is complete. */}
              {!schema.ok && (
                <ul className="mt-3 space-y-2">
                  {schema.checks.filter((c) => !c.present).map((c) => renderSchemaCheck(c, t))}
                </ul>
              )}
              {schema.checks.some((c) => c.present) && (
                <details className="mt-3">
                  <summary className="w-fit cursor-pointer py-2 md:py-0.5 text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                    {t("settings.schema.showPresent", { count: schema.checks.filter((c) => c.present).length })}
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {schema.checks.filter((c) => c.present).map((c) => renderSchemaCheck(c, t))}
                  </ul>
                </details>
              )}

              {schema.missingMigrations.length > 0 && (
                <p className="text-[11px] text-[var(--foreground-muted)] mt-3 leading-relaxed">
                  {withSlots(t("settings.schema.runInOrder"), {
                    dir: <span className="font-mono">{"supabase/migrations/"}</span>,
                    file: <span className="font-mono">{"supabase-schema.sql"}</span>,
                    list: <span className="font-mono text-[var(--foreground)]">{schema.missingMigrations.join(", ")}</span>,
                  })}
                </p>
              )}
            </>
          )}

          {/* Re-check stays reachable after a failed check too — that is when
              it is needed. */}
          {(schema || schemaError) && (
            <button onClick={loadSchema} disabled={schemaLoading} className={`mt-4 ${btn("secondary")}`}>
              {schemaLoading ? t("settings.checking") : t("settings.schema.recheck")}
            </button>
          )}
          </div>
        </FormSection>

        {/* ── Homepage showcase ── */}
        <FormSection
          id="showcase"
          title={t("settings.showcase.title")}
          description={t("settings.showcase.description")}
          extra={<HelpButton help={showcaseHelp} label={t("settings.showcase.helpLabel")} />}
        >
          {showcaseHelp.open && (
            <HelpPanel help={showcaseHelp}>
              <p>{t("settings.showcase.help")}</p>
            </HelpPanel>
          )}
          {catalogErrors.length > 0 && (
            <p className="text-[12px] text-[var(--err)] leading-relaxed">
              {t("settings.showcase.catalogNote", {
                errors: catalogErrors.map((f) => sayFailure(f, t)).join(" "),
                missing: t("settings.thumb.missing"),
              })}
            </p>
          )}
          <div className="space-y-5">
          {showcaseLoad === "loading" && <LoadingLine label={t("settings.showcase.loading")} />}
          {showcaseLoad === "error" && (
            <SelectionLoadFailed message={sayFailure(showcaseLoadError, t)} onRetry={loadShowcase} />
          )}
          {showcaseLoad === "ready" && STEP_META.map((meta) => (
            <div key={meta.key}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                <span className="font-mono text-[11px] text-[var(--foreground-subtle)] tabular-nums">{meta.n}</span>
                <span className="text-[12px] font-medium text-[var(--foreground)]">{t(meta.title)}</span>
                <span className="text-[12px] text-[var(--foreground-subtle)] ml-auto">{t(meta.hint)}</span>
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
                    label={t(meta.source === "outfits" ? "settings.showcase.addLook" : "settings.showcase.addProduct", {
                      step: t(meta.title),
                    })}
                    onClick={() => setPickerStep(meta.key)}
                  />
                )}
              </div>
            </div>
          ))}
          </div>
          {showcaseError && <p role="alert" className="text-[12px] text-[var(--err)]">{sayFailure(showcaseError, t)}</p>}
        </FormSection>

        {/* ── AI Stylist showcase ── */}
        <FormSection
          id="stylist"
          title={t("settings.stylist.title")}
          description={t("settings.stylist.description")}
          extra={<HelpButton help={stylistHelp} label={t("settings.stylist.helpLabel")} />}
        >
          {stylistHelp.open && (
            <HelpPanel help={stylistHelp}>
              <p>{t("settings.stylist.help")}</p>
            </HelpPanel>
          )}
          <div className="space-y-5">
          {stylistLoad === "loading" && <LoadingLine label={t("settings.stylist.loading")} />}
          {stylistLoad === "error" && (
            <SelectionLoadFailed message={sayFailure(stylistLoadError, t)} onRetry={loadStylist} />
          )}
          {stylistLoad === "ready" && (
            <>
              {/* Chat looks */}
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                  <span className="text-[12px] font-medium text-[var(--foreground)]">{t("settings.stylist.chat")}</span>
                  <span className="text-[12px] text-[var(--foreground-subtle)] ml-auto">
                    {t("settings.stylist.chatHint", { count: MAX_CHAT_LOOKS })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {stylist.chatOutfits.map((id) => (
                    <SelectedThumb
                      key={id}
                      id={id}
                      item={lookItems.find((x) => x.id === id)}
                      fit="cover"
                      onRemove={() => toggleChatOutfit(id)}
                    />
                  ))}
                  {stylist.chatOutfits.length < MAX_CHAT_LOOKS && (
                    <AddSlotButton label={t("settings.stylist.addChat")} onClick={() => setStylistPicker("chat")} />
                  )}
                </div>
              </div>

              {/* Featured product */}
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                  <span className="text-[12px] font-medium text-[var(--foreground)]">{t("settings.stylist.featured")}</span>
                  <span className="text-[12px] text-[var(--foreground-subtle)] ml-auto">
                    {t("settings.stylist.featuredHint")}
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
                    <AddSlotButton label={t("settings.stylist.addFeatured")} onClick={() => setStylistPicker("featured")} />
                  )}
                </div>
              </div>

              {/* Stores shown in "Where to buy" */}
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                  <span className="text-[12px] font-medium text-[var(--foreground)]">{t("settings.stylist.stores")}</span>
                  <HelpButton help={storesHelp} label={t("settings.stylist.storesHelpLabel")} />
                  <span className="text-[12px] text-[var(--foreground-subtle)] ml-auto">
                    {t("settings.stylist.storesLimit", { count: MAX_SHOWCASE_STORES })}
                  </span>
                </div>
                {storesHelp.open && (
                  <div className="mb-3">
                    <HelpPanel help={storesHelp}>
                      <p>{t("settings.stylist.storesHelp")}</p>
                    </HelpPanel>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {stylist.extraStores.map(({ name, price }) => {
                    const store = SUPPORTED_STORES.find(
                      (x) => x.name.toLowerCase() === name.toLowerCase()
                    );
                    return (
                      <div
                        key={name}
                        className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
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
                            <span className="text-[11px] font-semibold text-[var(--foreground-subtle)]">
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
                            placeholder={t("settings.stylist.price")}
                            aria-label={t("settings.stylist.priceAt", { store: name })}
                            className={`w-24 ${INPUT}`}
                          />
                        </div>
                        <button
                          onClick={() => removeShowcaseStore(name)}
                          className={`shrink-0 ${BTN_ICON}`}
                          aria-label={t("settings.thumb.remove", { name })}
                          title={t("settings.thumb.remove", { name })}
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
                      className={`self-start ${btn("secondary")}`}
                      aria-label={t("settings.stylist.addStore")}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      {t("settings.stylist.addStore")}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
          </div>
          {stylistError && <p role="alert" className="text-[12px] text-[var(--err)]">{sayFailure(stylistError, t)}</p>}
        </FormSection>

        {/* ── OpenAI key ── */}
        <FormSection
          id="openai"
          title={t("settings.openai.title")}
          description={t("settings.openai.description")}
          extra={<HelpButton help={openaiHelp} label={t("settings.openai.helpLabel")} />}
        >
          {openaiHelp.open && (
            <HelpPanel help={openaiHelp}>
              <p>{t("settings.openai.help")}</p>
            </HelpPanel>
          )}
          <div>
          {/* Loading */}
          {status === null && !loadError && <LoadingLine label={t("common.loading")} />}

          {/* Load error */}
          {loadError && (
            <div>
              <p className="text-[11px] text-[var(--err)]">{sayFailure(loadError, t)}</p>
              <button onClick={loadStatus} className={`mt-3 ${btn("secondary")}`}>
                {t("common.retry")}
              </button>
            </div>
          )}

          {/* Not configured */}
          {status && !status.configured && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[var(--border-strong)]" />
                <p className="text-[11px] font-medium text-[var(--foreground-muted)]">
                  {t("settings.openai.notConfigured")}
                </p>
              </div>
              <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed">{t("settings.openai.offList")}</p>
            </div>
          )}

          {/* Configured — env source */}
          {status?.configured && status.source === "env" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[var(--ok)]" />
                <p className="text-[11px] font-medium text-[var(--foreground)]">
                  {t("settings.openai.configured")}
                </p>
              </div>
              {status.maskedKey && (
                <p className="font-mono text-[11px] text-[var(--foreground-muted)] mb-1 break-all">{status.maskedKey}</p>
              )}
              <p className="text-[11px] text-[var(--foreground-subtle)] leading-relaxed">
                {withSlots(t("settings.openai.viaEnv"), {
                  env: <code className="font-mono text-[11px]">{"OPENAI_API_KEY"}</code>,
                })}
              </p>
            </div>
          )}

          {/* Configured — database source */}
          {status?.configured && status.source === "database" && !showInput && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[var(--ok)]" />
                <p className="text-[11px] font-medium text-[var(--foreground)]">
                  {t("settings.openai.configured")}
                </p>
              </div>
              {status.maskedKey && (
                <p className="font-mono text-[11px] text-[var(--foreground-muted)] mb-1 break-all">{status.maskedKey}</p>
              )}
              <p className="text-[11px] text-[var(--foreground-subtle)] mb-4">{t("settings.openai.inDb")}</p>
            </div>
          )}

          {/* Input form — add or update */}
          {editingKey && (
            <div>
              {status?.configured && (
                <p className="text-[11px] text-[var(--foreground-muted)] mb-3">{t("settings.openai.replaceHint")}</p>
              )}
              <label htmlFor="openai-key-input" className={FIELD_LABEL}>
                {status?.configured ? t("settings.openai.newKey") : t("settings.openai.key")}
              </label>
              <div className="relative">
                <input
                  id="openai-key-input"
                  type={showRaw ? "text" : "password"}
                  value={inputKey}
                  onChange={(e) => { setInputKey(e.target.value); setSaveError(""); }}
                  placeholder={KEY_PLACEHOLDER}
                  spellCheck={false}
                  autoComplete="off"
                  className={`w-full pr-10 md:pr-9 font-mono ${INPUT}`}
                />
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  aria-label={showRaw ? t("settings.openai.hideKey") : t("settings.openai.showKey")}
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
                <p className="text-[11px] text-[var(--err)] mt-2">{sayFailure(saveError, t)}</p>
              )}
            </div>
          )}

          {/* Test result */}
          {testResult === "ok" && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--ok)]">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("settings.openai.valid")}
            </div>
          )}
          {testResult === "fail" && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-[var(--err)]">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
                <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>{testError ? sayFailure(testError, t) : t("settings.openai.invalid")}</span>
            </div>
          )}

          {/* Clear error */}
          {clearError && (
            <p className="text-[11px] text-[var(--err)] mt-3">{sayFailure(clearError, t)}</p>
          )}
          </div>

          {/* The key's own actions. Saving a typed key is the page's SaveBar. */}
          {status !== null && (status.configured || editingKey) && (
            <div className="flex items-center gap-2 flex-wrap">
            {/* Cancel — only in update mode (a key is already configured) */}
            {editingKey && status.configured && (
              <button
                onClick={() => { setShowInput(false); setInputKey(""); setSaveError(""); }}
                className={btn("ghost")}
              >
                {t("common.cancel")}
              </button>
            )}

            {/* Test key */}
            {status.configured && !showInput && (
              <>
                <button
                  onClick={testKey}
                  disabled={testing}
                  className={btn("secondary")}
                >
                  {testing && <Spinner />}
                  {testing ? t("settings.openai.testing") : t("settings.openai.test")}
                </button>

                {/* Update key — only for database-stored keys */}
                {status.source === "database" && (
                  <button
                    onClick={() => { setShowInput(true); setTestResult(null); }}
                    className={btn("secondary")}
                  >
                    {t("settings.openai.update")}
                  </button>
                )}
              </>
            )}

            {/* Clear — only for database-stored keys */}
            {status.configured && status.source === "database" && !showInput && (
              <button
                onClick={clearKey}
                disabled={clearing}
                className={`ml-auto ${btn("danger")}`}
              >
                {clearing ? t("settings.openai.clearing") : t("settings.openai.clear")}
              </button>
            )}
            </div>
          )}
        </FormSection>

        {/* ── Embeddings ── */}
        <EmbeddingsCard />
      </FormPanel>

      <SaveBar
        dirty={dirty}
        saving={savingAll}
        onSave={() => void saveAll()}
        onDiscard={discardAll}
      />

      {/* ── Pickers ── */}
      {pickerStep && (() => {
        const meta = STEP_META.find((m) => m.key === pickerStep)!;
        const isLooks = meta.source === "outfits";
        return (
          <PickerModal
            title={`${meta.n} · ${t(meta.title)}`}
            noun={isLooks ? "look" : "product"}
            items={itemsForStep(pickerStep)}
            selectedIds={showcase[pickerStep]}
            max={meta.max}
            onPick={(id) => toggleItem(pickerStep, id)}
            onClose={() => setPickerStep(null)}
            searchPlaceholder={isLooks ? t("settings.picker.searchLooks") : t("settings.picker.searchProducts")}
            emptyText={isLooks ? t("settings.picker.noLooks") : t("settings.picker.noProducts")}
          />
        );
      })()}

      {stylistPicker === "chat" && (
        <PickerModal
          title={t("settings.stylist.chat")}
          noun="look"
          items={lookItems}
          selectedIds={stylist.chatOutfits}
          max={MAX_CHAT_LOOKS}
          onPick={toggleChatOutfit}
          onClose={() => setStylistPicker(null)}
          searchPlaceholder={t("settings.picker.searchLooks")}
          emptyText={t("settings.picker.noOutfits")}
          fit="cover"
        />
      )}
      {stylistPicker === "featured" && (
        <PickerModal
          title={t("settings.stylist.featured")}
          noun="product"
          items={products}
          selectedIds={stylist.featuredProduct ? [stylist.featuredProduct] : []}
          max={1}
          onPick={setFeaturedProduct}
          onClose={() => setStylistPicker(null)}
          searchPlaceholder={t("settings.picker.searchProducts")}
          emptyText={t("settings.picker.noProducts")}
        />
      )}
      {stylistPicker === "stores" && (
        <PickerModal
          title={t("settings.picker.stores")}
          noun="store"
          items={SUPPORTED_STORES.map((s) => ({
            id: s.name,
            name: s.name,
            imageUrl: storeFaviconUrl(s.domain),
            sub: t("settings.picker.store"),
          }))}
          selectedIds={stylist.extraStores.map((s) => s.name)}
          max={MAX_SHOWCASE_STORES}
          onPick={toggleShowcaseStore}
          onClose={() => setStylistPicker(null)}
          searchPlaceholder={t("settings.picker.searchStores")}
          emptyText={t("settings.picker.noStores")}
          padded
          noImageText={t("settings.picker.noLogo")}
        />
      )}
    </AdminPage>
  );
}
