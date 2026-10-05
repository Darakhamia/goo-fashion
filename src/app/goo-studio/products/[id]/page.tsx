"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { Category, ColorGroup, Gender, Product, StyleKeyword } from "@/lib/types";
import { STYLE_KEYWORD_LIST as STYLE_KEYWORDS, styleLabel } from "@/lib/style-keywords";
import { groupForProduct, subcategoryToValue } from "@/lib/categories";
import { useCategoryTree } from "@/lib/hooks/useCategoryTree";
import { useCurrency } from "@/lib/context/currency-context";
import { storeFaviconUrl } from "@/lib/stores";
import { AdminPage } from "@/components/admin/AdminPage";
import { FormPanel, FormSection } from "@/components/admin/FormSection";
import { PageHeader } from "@/components/admin/PageHeader";
import { SaveBar } from "@/components/admin/SaveBar";
import { Badge } from "@/components/admin/Badge";
import { EmptyState, Thumb } from "@/components/admin/DataTable";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { useDownloadCards } from "@/components/admin/DownloadCardsButton";
import { BANNER, btn, BTN_ICON_SM, FIELD_LABEL, INPUT, PANEL } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT, type Key } from "@/app/goo-studio/_i18n";
import {
  categoryPath,
  DEFAULT_COLOR_GROUPS,
  defaultForm,
  formToPayload,
  GENDERS,
  NEW_ARRIVAL_WINDOW_MS,
  productToForm,
  sizePreset,
  sortSizes,
  SUGGESTED_BRANDS,
  swatchBackground,
  EXAMPLE,
  type ProductFormState,
  type RetailerForm,
} from "../_editor/form";
import { PhotoGrid } from "../_editor/PhotoGrid";
import { StoreTable } from "../_editor/StoreTable";

/*
 * The product page (GS6-1, ADMIN_DESIGN «Товар», mockup "Product page"):
 * /goo-studio/products/<id> edits a product, /goo-studio/products/new adds
 * one (?from=<id> starts from a copy). It replaces the editor that was a
 * modal over the list: the page has an address, Back works, and it can be
 * linked to from Audit, AI check and Duplicates.
 *
 * The column: Basics · Photos · Category and sizes · Colors · Style · Stores
 * and price. Beside it: the card as the site shows it, what Audit's AI check
 * says about this product, and its history. One SaveBar saves everything.
 */

type Fix = {
  id: number;
  field: string;
  beforeText: string;
  afterText: string;
  writable: boolean;
  reason: string;
  confidence: string;
};
type HistoryEntry = { id: number; action: string; by: string | null; at: string };
type Payload = {
  product: Product;
  group: Product[];
  /** The group read failed: the page says so, and saving leaves the group alone. */
  groupError: string | null;
  quality: { suggested: Fix[]; applied: Fix[] } | null;
  history: HistoryEntry[] | null;
};

type FieldSuggestion = {
  field: "category" | "subcategory" | "gender" | "colorGroups";
  value: string | string[];
  confidence: "high" | "low";
  why: string;
  replaces?: string;
  alsoSetsCategory?: string;
};

/** Each suggested field by the name the form gives it. */
const SUGGESTION_LABEL: Record<FieldSuggestion["field"], Key> = {
  category: "products.f.category",
  subcategory: "products.field.subcategory",
  gender: "products.f.gender",
  colorGroups: "products.field.colorGroups",
};

/** Which section a form field is in, for the SaveBar's "Unsaved: …". */
const SECTION_OF: Record<keyof ProductFormState, Key> = {
  name: "products.page.basics",
  brand: "products.page.basics",
  gender: "products.page.basics",
  description: "products.page.basics",
  material: "products.page.basics",
  isNew: "products.page.basics",
  images: "products.photos.title",
  category: "products.page.category",
  subcategory: "products.page.category",
  sizes: "products.page.category",
  colorsRaw: "products.page.colors",
  colorGroupIds: "products.page.colors",
  variantColorHex: "products.page.colors",
  linkedProductIds: "products.page.colors",
  styleKeywords: "products.field.styles",
  retailers: "products.page.stores",
  priceMin: "products.page.stores",
  priceMax: "products.page.stores",
};

const CHIP = "px-2.5 py-1 text-[12px] border rounded-full transition-colors";
const chip = (on: boolean) =>
  `${CHIP} ${on ? "bg-[var(--foreground)] text-[var(--surface)] border-[var(--foreground)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// useSearchParams (?from= for a copy) needs a Suspense boundary above it.
export default function ProductPageRoute() {
  return (
    <Suspense>
      <ProductPage />
    </Suspense>
  );
}

function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const t = useT();
  const f = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const cards = useDownloadCards("products");
  const tree = useCategoryTree();
  const subcatToValue = useMemo(() => subcategoryToValue(tree), [tree]);
  const { convertToUsd, canConvert } = useCurrency();

  const isNew = id === "new";
  const fromId = isNew ? search.get("from") : null;

  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState<ProductFormState>(defaultForm);
  const [baseline, setBaseline] = useState<ProductFormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const canWrite = dbConfigured === true;

  const [colorGroups, setColorGroups] = useState<ColorGroup[]>(DEFAULT_COLOR_GROUPS);
  const [brands, setBrands] = useState<string[]>(SUGGESTED_BRANDS);
  const [storeLibrary, setStoreLibrary] = useState<{ name: string; logoUrl: string | null }[]>([]);
  const [storeRules, setStoreRules] = useState<{ domain: string; name: string }[]>([]);
  /** The whole catalogue, read only when a color variant is being looked for. */
  const [catalog, setCatalog] = useState<Product[] | null>(null);

  const load = async () => {
    setLoadError(null);
    const target = isNew ? fromId : id;
    if (!target) {
      setForm(defaultForm);
      setBaseline(defaultForm);
      return;
    }
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(target)}`);
      const body = await res.json().catch(() => null);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok || !body?.product) throw new Error(body?.error || t("products.load.failedHttp", { status: String(res.status) }));
      const payload = body as Payload;
      const filled = productToForm(payload.product, isNew ? [] : payload.group.map((p) => p.id), tree);
      if (isNew) {
        // Not from the dictionary: the suffix is saved as part of the name, and
        // catalog names are English whatever language the admin is in.
        const copy = { ...filled, name: `${filled.name} (Copy)` };
        setForm(copy);
        setBaseline(defaultForm);
      } else {
        setData(payload);
        setForm(filled);
        setBaseline(filled);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t("products.load.failed"));
    }
  };

  useEffect(() => {
    void load();
    fetch("/api/products/seed")
      .then((r) => setDbConfigured(r.status !== 501))
      .catch(() => setDbConfigured(false));
    fetch("/api/color-groups")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setColorGroups(d); })
      .catch(() => {});
    // The store library behind the store name field: brands with their logos,
    // and the store names set on the Retailers page (the names imports write).
    Promise.all([
      fetch("/api/brands").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/retailer-domains?rulesOnly=1").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([brandList, retailerDomains]) => {
      const library = new Map<string, { name: string; logoUrl: string | null }>();
      if (Array.isArray(brandList) && brandList.length > 0) {
        setBrands(brandList.map((b: { name: string }) => b.name).sort());
        for (const b of brandList as { name: string; logoUrl?: string | null }[]) {
          library.set(b.name.trim().toLowerCase(), { name: b.name, logoUrl: b.logoUrl ?? null });
        }
      }
      const rules = (retailerDomains?.rules ?? []) as { domain: string; name: string }[];
      setStoreRules(
        rules
          .filter((r) => r.domain && r.name?.trim())
          .map((r) => ({ domain: r.domain.trim().toLowerCase().replace(/^www\./, ""), name: r.name.trim() })),
      );
      for (const r of rules) {
        const key = r.name?.trim().toLowerCase();
        if (!key) continue;
        const known = library.get(key);
        if (!known) library.set(key, { name: r.name.trim(), logoUrl: storeFaviconUrl(r.domain) });
        else if (!known.logoUrl) library.set(key, { ...known, logoUrl: storeFaviconUrl(r.domain) });
      }
      setStoreLibrary([...library.values()].sort((a, b) => a.name.localeCompare(b.name)));
    });
    // Once per product: the id is the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fromId]);

  /**
   * A store's price on the catalogue's scale: `price_min` is read as dollars by
   * the browse filter, the stylist's budget and the search RPCs. NaN for a
   * price that is missing or in a currency with no known rate.
   */
  const storeUsd = (r: RetailerForm): number => {
    const amount = parseFloat(r.price);
    const code = (r.currency || "USD").toUpperCase();
    if (!(amount > 0) || !canConvert(code)) return NaN;
    return Math.round(convertToUsd(amount, code) * 100) / 100;
  };
  /** The catalogue price from the store prices, when there are any. */
  const withStorePrices = (next: ProductFormState): ProductFormState => {
    const prices = next.retailers.map(storeUsd).filter((x) => x > 0);
    if (!prices.length) return next;
    return { ...next, priceMin: String(Math.min(...prices)), priceMax: String(Math.max(...prices)) };
  };

  const set = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const dirty = !same(form, baseline);
  const changedSections = [...new Set((Object.keys(form) as (keyof ProductFormState)[]).filter((k) => !same(form[k], baseline[k])).map((k) => t(SECTION_OF[k])))];

  /** Leaving with unsaved edits asks first (the SaveBar only covers a reload). */
  const leave = async (href: string) => {
    if (dirty && !(await confirm({ title: t("products.page.leaveTitle"), body: t("products.page.leaveBody"), confirmLabel: t("products.page.leaveAction"), tone: "danger" }))) return;
    router.push(href);
  };

  // ── Color variants ────────────────────────────────────────────────────────
  const product = data?.product ?? null;
  const known = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of catalog ?? []) map.set(p.id, p);
    for (const p of data?.group ?? []) map.set(p.id, p);
    return map;
  }, [catalog, data]);
  const [variantQuery, setVariantQuery] = useState("");
  const loadCatalog = () => {
    if (catalog) return;
    fetch("/api/products?raw=true")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCatalog(d); })
      .catch(() => {});
  };

  /**
   * Brings the variant group in line with "Same piece in other colors". Only
   * what changed is written: re-posting an unchanged group made whichever
   * variant was saved the group's primary. A product taken out is unlinked.
   */
  const syncVariants = async (savedId: string): Promise<{ changed: boolean; error: string | null }> => {
    const ownGroup = isNew ? undefined : product?.variantGroupId;
    const before = isNew ? [] : baseline.linkedProductIds;
    const after = form.linkedProductIds;
    const removed = before.filter((x) => !after.includes(x));
    const added = after.filter((x) => !before.includes(x));
    const hexChanged = !!ownGroup && baseline.variantColorHex !== form.variantColorHex;

    const call = async (method: "POST" | "DELETE", body: unknown): Promise<string | null> => {
      const res = await fetch("/api/products/group", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) return null;
      const err = await res.json().catch(() => ({}));
      return (err.error as string) || t("products.save.variantsFailedHttp", { status: String(res.status) });
    };

    if (!after.length) {
      if (!ownGroup || !before.length) return { changed: false, error: null };
      return { changed: true, error: await call("DELETE", { groupId: ownGroup }) };
    }
    if (ownGroup && !added.length && !removed.length && !hexChanged) return { changed: false, error: null };
    if (removed.length) {
      const error = await call("DELETE", { ids: removed });
      if (error) return { changed: true, error };
    }
    // Into this product's own group, else the one its new variants already
    // share, else a new one. A primaryId outside `ids` leaves the primary alone.
    const linkedGroups = new Set(after.map((x) => known.get(x)?.variantGroupId).filter(Boolean));
    const groupId = ownGroup ?? (linkedGroups.size === 1 ? ([...linkedGroups][0] as string) : undefined);
    const members = [...(data?.group ?? []), ...(catalog ?? [])];
    const currentPrimary = groupId
      ? (product?.variantGroupId === groupId && product.isGroupPrimary ? product.id : undefined) ??
        members.find((p) => p.variantGroupId === groupId && p.isGroupPrimary && !removed.includes(p.id))?.id
      : undefined;
    const colorHexMap: Record<string, string> = { [savedId]: form.variantColorHex };
    for (const x of after) colorHexMap[x] = known.get(x)?.colorHex ?? "#888888";
    const error = await call("POST", { ids: [savedId, ...after], primaryId: currentPrimary ?? savedId, colorHexMap, groupId });
    return { changed: true, error };
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.err(t("products.page.nameRequired"));
      return;
    }
    if (!canWrite) return;
    setSaving(true);
    try {
      const next = withStorePrices(form);
      const res = await fetch(isNew ? "/api/products" : `/api/products/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(next)),
      });
      const saved = await res.json().catch(() => null);
      if (!res.ok || !saved?.id) {
        toast.err(saved?.error || t("products.save.failedHttp", { status: String(res.status) }));
        return;
      }
      // The API drops columns the database lacks rather than failing the save;
      // a variant failure is reported, not retried by a second Save.
      const problems: string[] = [];
      if (saved.warning) problems.push(saved.warning);
      let variants: { changed: boolean; error: string | null };
      try {
        variants = await syncVariants(saved.id);
      } catch (e) {
        variants = { changed: true, error: e instanceof Error ? e.message : t("common.networkError") };
      }
      if (variants.error) problems.push(t("products.save.variantsFailed", { error: variants.error }));
      if (problems.length) toast.err(problems.join(" · "));
      else toast.ok(t(isNew ? "products.save.added" : "products.save.updated"));

      setBaseline(next);
      setForm(next);
      if (isNew) router.replace(`/goo-studio/products/${saved.id}`);
      else void load();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.save.failed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!canWrite || isNew) return;
    if (!(await confirm({ title: t("products.delete.title"), confirmLabel: t("products.delete.action"), tone: "danger" }))) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      // 409 names the outfits that still use it.
      const json = await res.json().catch(() => ({}));
      toast.err(json.error || t("products.delete.failedHttp", { status: String(res.status) }));
      return;
    }
    toast.ok(t("products.delete.done"));
    setBaseline(form);
    router.push("/goo-studio/products");
  };

  // ── AI field suggestions ─────────────────────────────────────────────────
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<FieldSuggestion[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const runSuggest = async () => {
    if (!form.name.trim()) { toast.err(t("products.suggest.needName")); return; }
    setSuggesting(true);
    try {
      const res = await fetch("/api/admin/suggest-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          brand: form.brand,
          colors: form.colorsRaw.split(",").map((c) => c.trim()).filter(Boolean),
          category: form.category,
          subcategory: form.subcategory,
          gender: form.gender,
          colorGroups: form.colorGroupIds.map((g) => colorGroups.find((x) => x.id === g)?.name).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.err(json.error ?? t("products.suggest.failed")); return; }
      const found = (json.suggestions ?? []) as FieldSuggestion[];
      setSuggestions(found);
      // Only the confident ones start ticked.
      setChosen(new Set(found.filter((s) => s.confidence === "high").map((s) => s.field)));
      if (!found.length) toast.ok(t("products.suggest.none"));
    } catch {
      toast.err(t("products.suggest.offline"));
    } finally {
      setSuggesting(false);
    }
  };
  const applySuggestions = () => {
    const taking = (suggestions ?? []).filter((s) => chosen.has(s.field));
    if (!taking.length) return;
    setForm((prev) => {
      const next = { ...prev };
      for (const s of taking) {
        if (s.field === "subcategory") {
          next.subcategory = String(s.value);
          // The tree says which category the label belongs to.
          if (s.alsoSetsCategory) next.category = s.alsoSetsCategory as Category;
        } else if (s.field === "category") {
          next.category = String(s.value) as Category;
        } else if (s.field === "gender") {
          next.gender = String(s.value) as Gender;
        } else if (s.field === "colorGroups") {
          const ids = (s.value as string[])
            .map((name) => colorGroups.find((g) => g.name.toLowerCase() === name.toLowerCase())?.id)
            .filter((x): x is number => typeof x === "number");
          next.colorGroupIds = [...new Set([...prev.colorGroupIds, ...ids])];
        }
      }
      return next;
    });
    toast.ok(t("products.suggest.filled", { count: taking.length }));
    setSuggestions(null);
    setChosen(new Set());
  };

  // ── AI check fixes for this product ──────────────────────────────────────
  const [deciding, setDeciding] = useState<number | null>(null);
  const decide = async (fix: Fix, action: "apply" | "dismiss") => {
    // An applied fix rewrites the product: edits not saved yet would be lost
    // when the page reloads it.
    if (action === "apply" && dirty && !(await confirm({ title: t("products.page.applyDirtyTitle"), body: t("products.page.applyDirtyBody"), confirmLabel: t("products.page.applyDirtyAction") }))) return;
    setDeciding(fix.id);
    try {
      const res = await fetch("/api/admin/catalogue-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: [fix.id] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.err(json.error || t("products.page.fixFailed")); return; }
      if (json.stale) toast.err(t("products.page.fixStale"));
      else toast.ok(t(action === "apply" ? "products.page.fixApplied" : "products.page.fixDismissed"));
      await load();
    } catch {
      toast.err(t("common.networkError"));
    } finally {
      setDeciding(null);
    }
  };

  // ── Brand picker ─────────────────────────────────────────────────────────
  const [brandOpen, setBrandOpen] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) setBrandOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const addBrand = async (name: string) => {
    setAddingBrand(true);
    try {
      const res = await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      if (res.ok) setBrands((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
      else {
        const json = await res.json().catch(() => ({}));
        toast.err(json.error || t("products.brand.addFailedHttp", { status: String(res.status) }));
      }
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.brand.addFailed"));
    } finally {
      setAddingBrand(false);
    }
    // The name stays on the product either way; only the brand list missed it.
    set("brand", name);
    setBrandOpen(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <AdminPage>
        <PageHeader title={t("products.page.notFoundTitle")} />
        <div className={PANEL}>
          <EmptyState
            text={t("products.page.notFound")}
            action={<Link href="/goo-studio/products" className={btn("secondary")}>{t("products.page.back")}</Link>}
          />
        </div>
      </AdminPage>
    );
  }

  const loading = !isNew && !data && !loadError;
  const issues = data?.quality?.suggested.length ?? 0;
  const storesWithPrice = form.retailers.map(storeUsd).filter((x) => x > 0);
  /** Currencies the catalog price was converted from: "converted from UAH to USD". */
  const converted = [...new Set(form.retailers.filter((r) => storeUsd(r) > 0 && (r.currency || "USD").toUpperCase() !== "USD").map((r) => r.currency.toUpperCase()))];
  const priceRange = (() => {
    const min = parseFloat(withStorePrices(form).priceMin);
    const max = parseFloat(withStorePrices(form).priceMax);
    if (!(min > 0)) return null;
    return max > min ? `${f.money(min)}–${f.money(max)}` : f.money(min);
  })();
  const createdMs = product?.createdAt ? new Date(product.createdAt).getTime() : NaN;
  const pastNewWindow = Number.isFinite(createdMs) && Date.now() - createdMs >= NEW_ARRIVAL_WINDOW_MS;
  const activeGroup = groupForProduct(form.category, form.subcategory, tree);
  const preset = sizePreset(form, tree);
  const colorCount = 1 + form.linkedProductIds.length;

  const title = isNew ? t(fromId ? "products.editor.duplicate" : "products.add") : form.name || product?.name || t("products.editor.edit");
  const meta = [form.brand, categoryPath(form.category, form.subcategory, tree)].filter(Boolean).join(" · ");

  const aside = (
    <div className="flex flex-col gap-4 xl:sticky xl:top-4">
      <section aria-labelledby="preview-title" className={`${PANEL} p-4`}>
        <h2 id="preview-title" className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-3">{t("products.page.preview")}</h2>
        <div className="aspect-[3/4] rounded-lg overflow-hidden bg-[var(--background)] mb-3">
          {form.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.images[0]} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <p className="text-[13px] font-medium text-[var(--foreground)] leading-snug">{form.name || "—"}</p>
        <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">
          {[form.brand, colorCount > 1 ? t("products.page.colorCount", { count: colorCount }) : null].filter(Boolean).join(" · ")}
        </p>
        <p className="text-[13px] text-[var(--foreground)] mt-1 tabular-nums">{priceRange ?? "—"}</p>
      </section>

      {!isNew && data?.quality && (
        <section aria-labelledby="quality-title" className={`${PANEL} p-4`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 id="quality-title" className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">{t("products.page.quality")}</h2>
            <Link href="/goo-studio/catalogue-check" className="text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline-offset-2 hover:underline">
              {t("products.page.openAiCheck")}
            </Link>
          </div>
          {data.quality.suggested.length === 0 && data.quality.applied.length === 0 && (
            <p className="text-[12px] text-[var(--foreground-muted)]">{t("products.page.qualityNone")}</p>
          )}
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {data.quality.suggested.map((fix) => (
              <li key={fix.id} className="py-2.5 flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-[var(--warn)]" aria-hidden="true" />
                  <div className="min-w-0 text-[12px] leading-[18px]">
                    <p className="text-[var(--foreground)]">
                      <span className="text-[var(--foreground-muted)]">{fix.field}:</span>{" "}
                      {fix.writable ? (
                        <>
                          <span className="line-through text-[var(--foreground-subtle)]">{fix.beforeText || "—"}</span> → {fix.afterText || "—"}
                        </>
                      ) : (
                        fix.beforeText
                      )}
                    </p>
                    {fix.reason && <p className="text-[var(--foreground-muted)] break-words">{fix.reason}</p>}
                  </div>
                </div>
                <div className="flex gap-2 pl-3.5">
                  {fix.writable && (
                    <button type="button" onClick={() => void decide(fix, "apply")} disabled={deciding !== null || !canWrite} className={btn("secondary", "sm")}>
                      {t("products.page.apply")}
                    </button>
                  )}
                  <button type="button" onClick={() => void decide(fix, "dismiss")} disabled={deciding !== null || !canWrite} className={btn("ghost", "sm")}>
                    {t("common.dismiss")}
                  </button>
                </div>
              </li>
            ))}
            {data.quality.applied.map((fix) => (
              <li key={fix.id} className="py-2.5 flex items-start gap-2 text-[12px] leading-[18px]">
                <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-[var(--ok)]" aria-hidden="true" />
                <p className="min-w-0 text-[var(--foreground-muted)] break-words">
                  {t("products.page.fixedByCheck", { field: fix.field, value: fix.afterText || "—" })}
                </p>
              </li>
            ))}
          </ul>
          <Link href="/goo-studio/audit" className="inline-block mt-2 text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline-offset-2 hover:underline">
            {t("products.page.openAudit")}
          </Link>
        </section>
      )}

      {!isNew && data?.history && (
        <section aria-labelledby="history-title" className={`${PANEL} p-4`}>
          <h2 id="history-title" className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-2">{t("products.page.history")}</h2>
          {data.history.length === 0 ? (
            <p className="text-[12px] text-[var(--foreground-muted)]">{t("products.page.historyNone")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.history.map((h) => {
                const key = `act.${h.action}`;
                const label = t(key as Key);
                return (
                  <li key={h.id} className="flex items-baseline justify-between gap-3 text-[12px] leading-[18px]">
                    <span className="min-w-0 text-[var(--foreground)]">
                      {label === key ? h.action : label}
                      {h.by && <span className="text-[var(--foreground-muted)]"> · {h.by}</span>}
                    </span>
                    <span className="shrink-0 text-[var(--foreground-subtle)] tabular-nums">{f.when(h.at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );

  const section = (sid: string, titleKey: Key, descKey: Key, body: ReactNode, extra?: ReactNode) => (
    <FormSection id={sid} title={t(titleKey)} description={t(descKey)} extra={extra}>
      {body}
    </FormSection>
  );

  return (
    <AdminPage layout="form" aside={aside}>
      <button
        type="button"
        onClick={() => void leave("/goo-studio/products")}
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("nav.products")}
      </button>

      <div className="flex items-start gap-4">
        {form.images[0] && (
          <div className="hidden sm:block shrink-0 pt-0.5">
            <Thumb src={form.images[0]} size="lg" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <PageHeader
            title={title}
            subtitle={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {meta && <span>{meta}</span>}
                {form.isNew && !pastNewWindow && <Badge>{t("products.badge.new")}</Badge>}
                {form.retailers.length > 0 && <Badge>{t("products.stores.count", { count: form.retailers.length })}</Badge>}
                {issues > 0 && <Badge tone="warn">{t("products.page.issues", { count: issues })}</Badge>}
              </span>
            }
            actions={isNew ? [] : [{ key: "site", label: t("products.page.openOnSite"), onClick: () => window.open(`/product/${id}`, "_blank", "noopener") }]}
            menu={[
              { label: t(suggesting ? "products.suggest.reading" : "products.suggest.button"), hint: t("products.suggest.title"), onSelect: () => void runSuggest(), disabled: suggesting || !canWrite },
              ...(isNew
                ? []
                : [
                    { label: t("products.row.duplicate"), onSelect: () => void leave(`/goo-studio/products/new?from=${id}`), disabled: !canWrite },
                    { label: t("products.row.download"), onSelect: () => void cards.download([id]), disabled: cards.busy },
                    { kind: "separator" as const },
                    { label: t("products.row.delete"), tone: "danger" as const, onSelect: () => void remove(), disabled: !canWrite },
                  ]),
            ]}
          />
        </div>
      </div>

      {dbConfigured === false && (
        <div role="alert" className={`${BANNER.err} mb-4`}>{t("products.page.noDatabase")}</div>
      )}
      {loadError && (
        <div role="alert" className={`${BANNER.err} mb-4 flex flex-wrap items-center justify-between gap-4`}>
          {loadError}
          <button type="button" onClick={() => void load()} className={btn("secondary")}>{t("common.retry")}</button>
        </div>
      )}
      {data?.groupError && (
        <div className={`${BANNER.warn} mb-4`}>{t("products.page.groupFailed")}</div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className={`${PANEL} mb-4 p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <p className="text-[12px] text-[var(--foreground-muted)]">{t("products.suggest.source")}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={applySuggestions} disabled={!chosen.size} className={btn("secondary")}>
                {chosen.size ? t("products.suggest.fill", { count: chosen.size }) : t("products.suggest.fillNone")}
              </button>
              <button type="button" onClick={() => { setSuggestions(null); setChosen(new Set()); }} className={btn("ghost")}>
                {t("common.dismiss")}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {suggestions.map((s) => (
              <label key={s.field} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chosen.has(s.field)}
                  onChange={() => setChosen((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.field)) next.delete(s.field); else next.add(s.field);
                    return next;
                  })}
                  className="mt-0.5 accent-[var(--foreground)]"
                />
                <span className="text-[12px] leading-relaxed">
                  <span className="text-[var(--foreground-muted)]">{t(SUGGESTION_LABEL[s.field])}</span>{" "}
                  <span className="font-mono text-[var(--foreground)]">{Array.isArray(s.value) ? s.value.join(", ") : s.value}</span>
                  {s.replaces && <span className="text-[var(--warn)]"> — {t("products.suggest.replaces", { value: s.replaces })}</span>}
                  {s.alsoSetsCategory && <span className="text-[var(--foreground-muted)]"> · {t("products.suggest.alsoSets", { value: s.alsoSetsCategory })}</span>}
                  {s.confidence === "low" && <span className="text-[var(--warn)]"> · {t("products.suggest.unsure")}</span>}
                  <span className="block text-[var(--foreground-muted)]">{s.why}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[var(--foreground-muted)]">{t("products.suggest.footer")}</p>
        </div>
      )}

      {loading ? (
        <div className={`${PANEL} px-4 py-16 text-center text-[13px] text-[var(--foreground-muted)]`}>{t("common.loading")}</div>
      ) : (
        <FormPanel>
          {section("basics", "products.page.basics", "products.page.basicsHint", (
            <>
              <div>
                <label htmlFor="p-name" className={FIELD_LABEL}>{t("products.field.name")}</label>
                <input id="p-name" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("products.field.namePlaceholder")} className={`${INPUT} w-full`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div ref={brandRef} className="relative">
                  <label htmlFor="p-brand" className={FIELD_LABEL}>{t("products.f.brand")}</label>
                  <input
                    id="p-brand"
                    type="text"
                    value={form.brand}
                    onChange={(e) => { set("brand", e.target.value); setBrandOpen(true); }}
                    onFocus={() => setBrandOpen(true)}
                    onKeyDown={(e) => { if (e.key === "Escape") setBrandOpen(false); }}
                    placeholder={t("products.brand.placeholder")}
                    autoComplete="off"
                    className={`${INPUT} w-full`}
                  />
                  {brandOpen && (() => {
                    const q = form.brand.toLowerCase().trim();
                    const matches = brands.filter((b) => b.toLowerCase().includes(q)).slice(0, 50);
                    const exact = brands.some((b) => b.toLowerCase() === q);
                    if (!matches.length && !form.brand.trim()) return null;
                    return (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] max-h-56 overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                        {matches.map((b) => (
                          <button key={b} type="button" onMouseDown={(e) => { e.preventDefault(); set("brand", b); setBrandOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--fg-overlay-05)] transition-colors ${form.brand === b ? "text-[var(--foreground)] font-medium" : "text-[var(--foreground-muted)]"}`}>
                            {b}
                          </button>
                        ))}
                        {form.brand.trim() && !exact && (
                          <button type="button" disabled={addingBrand} onMouseDown={(e) => { e.preventDefault(); void addBrand(form.brand.trim()); }}
                            className="w-full text-left px-3 py-2 text-[13px] text-[var(--foreground)] border-t border-[var(--border)] hover:bg-[var(--fg-overlay-05)] transition-colors">
                            {t("products.brand.addNew", { name: form.brand.trim() })}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <span id="p-gender" className={FIELD_LABEL}>{t("products.f.gender")}</span>
                  <div role="radiogroup" aria-labelledby="p-gender" className="flex flex-wrap gap-1.5">
                    {GENDERS.map((g) => (
                      <button key={g.value} type="button" role="radio" aria-checked={form.gender === g.value}
                        onClick={() => set("gender", form.gender === g.value ? "" : g.value)}
                        className={chip(form.gender === g.value)}>
                        {t(g.label)}
                      </button>
                    ))}
                  </div>
                  {!form.gender && <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">{t("products.field.genderUnset")}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="p-desc" className={FIELD_LABEL}>{t("products.field.description")}</label>
                <textarea id="p-desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("products.field.descriptionPlaceholder")} rows={3} className={`${INPUT} w-full resize-y`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="p-material" className={FIELD_LABEL}>{t("products.field.material")}</label>
                  <input id="p-material" type="text" value={form.material} onChange={(e) => set("material", e.target.value)} placeholder={EXAMPLE.material} className={`${INPUT} w-full`} />
                </div>
                <label className={`flex items-start gap-2 text-[13px] text-[var(--foreground)] sm:pt-7 ${pastNewWindow ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input type="checkbox" checked={form.isNew && !pastNewWindow} disabled={pastNewWindow} onChange={(e) => set("isNew", e.target.checked)} className="mt-0.5 w-3.5 h-3.5 accent-[var(--foreground)]" />
                  <span>
                    {t("products.isNew.label")}
                    <span className="block text-[12px] text-[var(--foreground-subtle)]">
                      {pastNewWindow ? t("products.isNew.expired", { date: f.date(product?.createdAt) }) : t("products.isNew.hint")}
                    </span>
                  </span>
                </label>
              </div>
            </>
          ))}

          {section("photos", "products.photos.title", "products.photos.hint", (
            <PhotoGrid images={form.images} disabled={!canWrite} onChange={(update) => setForm((prev) => ({ ...prev, images: update(prev.images) }))} />
          ))}

          {section("category", "products.page.category", "products.page.categoryHint", (
            <>
              <div>
                <span className={FIELD_LABEL}>{t("products.f.category")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {tree.map((g) => {
                    // Picking a group picks its first subcategory, so the
                    // stored category and subcategory can never disagree.
                    const first = g.items[0];
                    return (
                      <button key={g.id} type="button" disabled={!first} aria-pressed={activeGroup?.id === g.id}
                        title={first ? undefined : t("products.cat.emptyGroup", { group: g.label, section: t("nav.categories") })}
                        onClick={() => first && setForm((prev) => ({ ...prev, category: subcatToValue[first.label] as Category, subcategory: first.label }))}
                        className={`${chip(activeGroup?.id === g.id)} disabled:opacity-40 disabled:cursor-not-allowed`}>
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {activeGroup ? (
                <div>
                  <span className={FIELD_LABEL}>{t("products.field.subcategory")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeGroup.items.map((item) => (
                      <button key={item.label} type="button" aria-pressed={form.subcategory === item.label}
                        onClick={() => setForm((prev) => ({ ...prev, category: subcatToValue[item.label] as Category, subcategory: item.label }))}
                        className={chip(form.subcategory === item.label)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {!form.subcategory && <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">{t("products.cat.noSubcategory", { group: activeGroup.label })}</p>}
                </div>
              ) : (
                <p className="text-[12px] text-[var(--foreground-muted)]">{t("products.page.notInTree", { category: form.category })}</p>
              )}
              <SizePicker sizes={form.sizes} preset={preset} onChange={(next) => set("sizes", next)} />
            </>
          ))}

          {section("colors", "products.page.colors", "products.page.colorsHint", (
            <>
              <div>
                <label htmlFor="p-color" className={FIELD_LABEL}>{t("products.page.colorName")}</label>
                <input id="p-color" type="text" value={form.colorsRaw} onChange={(e) => set("colorsRaw", e.target.value)} placeholder={EXAMPLE.colors} className={`${INPUT} w-full`} />
                <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">{t("products.page.colorNameHint")}</p>
              </div>
              <div>
                <span className={FIELD_LABEL}>{t("products.page.colorFilters")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {colorGroups.map((cg) => {
                    const on = form.colorGroupIds.includes(cg.id);
                    return (
                      <button key={cg.id} type="button" aria-pressed={on}
                        onClick={() => set("colorGroupIds", on ? form.colorGroupIds.filter((x) => x !== cg.id) : [...form.colorGroupIds, cg.id])}
                        className={`${chip(on)} inline-flex items-center gap-1.5`}>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-[var(--border-strong)]" style={{ background: swatchBackground(cg.hexCode) }} aria-hidden="true" />
                        {cg.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">{t("products.page.colorFiltersHint")}</p>
              </div>
              <div>
                <span className={FIELD_LABEL}>{t("products.page.otherColors")}</span>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <input type="color" value={form.variantColorHex} onChange={(e) => set("variantColorHex", e.target.value)} aria-label={t("products.variants.swatchTitle")} title={t("products.variants.swatchTitle")} className="w-8 h-8 rounded-md border border-[var(--border)] cursor-pointer bg-transparent p-0.5 shrink-0" />
                  <span className="text-[12px] text-[var(--foreground-subtle)]">{t("products.variants.swatchHint")}</span>
                </div>
                {form.linkedProductIds.length > 0 && (
                  <ul className="flex flex-wrap gap-2 mb-2">
                    {form.linkedProductIds.map((lid) => {
                      const lp = known.get(lid);
                      return (
                        <li key={lid} className="flex items-center gap-2 rounded-lg border border-[var(--border)] pl-1 pr-1 py-1 max-w-full">
                          <Thumb src={lp?.imageUrl} />
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-[var(--border-strong)]" style={{ backgroundColor: lp?.colorHex ?? "#888888" }} aria-hidden="true" />
                          {lp ? (
                            <Link href={`/goo-studio/products/${lid}`} onClick={(e) => { if (dirty) { e.preventDefault(); void leave(`/goo-studio/products/${lid}`); } }} className="text-[12px] text-[var(--foreground)] truncate max-w-[180px] hover:underline underline-offset-2">
                              {lp.colors?.join(", ") || lp.name}
                            </Link>
                          ) : (
                            <span className="text-[12px] text-[var(--foreground-muted)] truncate max-w-[180px]">{lid}</span>
                          )}
                          <button type="button" onClick={() => set("linkedProductIds", form.linkedProductIds.filter((x) => x !== lid))}
                            aria-label={t("products.variants.remove", { name: lp?.name ?? lid })} title={t("products.variants.remove", { name: lp?.name ?? lid })} className={BTN_ICON_SM}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="relative">
                  <input type="text" value={variantQuery} onFocus={loadCatalog} onChange={(e) => { loadCatalog(); setVariantQuery(e.target.value); }}
                    placeholder={t("products.variants.search")} aria-label={t("products.variants.search")} className={`${INPUT} w-full`} />
                  {variantQuery.trim() && (() => {
                    if (!catalog) return <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">{t("common.loading")}</p>;
                    const q = variantQuery.toLowerCase();
                    const matches = catalog
                      .filter((p) => p.id !== id && !form.linkedProductIds.includes(p.id) && (p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)))
                      .slice(0, 6);
                    if (!matches.length) return <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">{t("products.page.noMatches")}</p>;
                    return (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] max-h-60 overflow-y-auto">
                        {matches.map((mp) => (
                          <button key={mp.id} type="button" onClick={() => { set("linkedProductIds", [...form.linkedProductIds, mp.id]); setVariantQuery(""); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[var(--fg-overlay-05)] transition-colors border-b border-[var(--border)] last:border-0">
                            <Thumb src={mp.imageUrl} />
                            <span className="text-[13px] text-[var(--foreground)] flex-1 truncate">{mp.name}</span>
                            <span className="text-[12px] text-[var(--foreground-muted)] shrink-0">{mp.brand}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          ))}

          {section("style", "products.field.styles", "products.page.styleHint", (
            <div className="flex flex-wrap gap-1.5">
              {STYLE_KEYWORDS.map((kw: StyleKeyword) => {
                const on = form.styleKeywords.includes(kw);
                return (
                  <button key={kw} type="button" aria-pressed={on}
                    onClick={() => set("styleKeywords", on ? form.styleKeywords.filter((k) => k !== kw) : [...form.styleKeywords, kw])}
                    className={chip(on)}>
                    {styleLabel(kw)}
                  </button>
                );
              })}
            </div>
          ))}

          {section("stores", "products.page.stores", "products.page.storesHint", (
            <>
              <StoreTable
                retailers={form.retailers}
                onChange={(r) => setForm((prev) => withStorePrices({ ...prev, retailers: r }))}
                storeLibrary={storeLibrary}
                storeRules={storeRules}
                disabled={!canWrite}
              />
              {storesWithPrice.length > 0 ? (
                <p className="text-[13px] text-[var(--foreground)]">
                  <span className="text-[var(--foreground-muted)]">{t("products.page.catalogPrice")}</span>{" "}
                  <span className="tabular-nums">{priceRange}</span>
                  <span className="text-[var(--foreground-muted)]">
                    {" · "}
                    {t("products.price.auto", { count: storesWithPrice.length })}
                    {converted.length > 0 && ` · ${t("products.price.converted", { currencies: converted.join(", ") })}`}
                  </span>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <div>
                    <label htmlFor="p-min" className={FIELD_LABEL}>{t("products.price.min")}</label>
                    <input id="p-min" type="number" min="0" value={form.priceMin} onChange={(e) => set("priceMin", e.target.value)} placeholder="0" className={`${INPUT} w-full tabular-nums`} />
                  </div>
                  <div>
                    <label htmlFor="p-max" className={FIELD_LABEL}>{t("products.price.max")}</label>
                    <input id="p-max" type="number" min="0" value={form.priceMax} onChange={(e) => set("priceMax", e.target.value)} placeholder="0" className={`${INPUT} w-full tabular-nums`} />
                  </div>
                </div>
              )}
            </>
          ))}
        </FormPanel>
      )}

      <SaveBar
        dirty={dirty}
        saving={saving}
        disabled={!canWrite || !form.name.trim()}
        note={changedSections.length ? t("products.page.unsavedIn", { list: changedSections.join(", ") }) : undefined}
        onSave={() => void save()}
        onDiscard={() => setForm(baseline)}
      />
    </AdminPage>
  );
}

/**
 * Sizes in one place (GS6-1): the subcategory's chart as chips, and a custom
 * size for anything the chart lacks. The order follows the chart.
 */
function SizePicker({ sizes, preset, onChange }: { sizes: string[]; preset: string[]; onChange: (next: string[]) => void }) {
  const t = useT();
  const [custom, setCustom] = useState("");
  const [adding, setAdding] = useState(false);
  const extra = sizes.filter((s) => !preset.includes(s));
  const toggle = (size: string) =>
    onChange(sortSizes(sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size], preset));
  const addCustom = () => {
    const parts = custom.split(",").map((s) => s.trim()).filter((s) => s && !sizes.includes(s));
    if (parts.length) onChange(sortSizes([...sizes, ...parts], preset));
    setCustom("");
    setAdding(false);
  };
  return (
    <div>
      <span id="p-sizes" className={FIELD_LABEL}>{t("products.page.sizes")}</span>
      <div role="group" aria-labelledby="p-sizes" className="flex flex-wrap items-center gap-1.5">
        {[...preset, ...extra].map((size) => (
          <button key={size} type="button" aria-pressed={sizes.includes(size)} onClick={() => toggle(size)}
            className={`${chip(sizes.includes(size))} min-w-[36px] text-center`}>
            {size}
          </button>
        ))}
        {adding ? (
          <input
            autoFocus
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addCustom(); }
              if (e.key === "Escape") { setCustom(""); setAdding(false); }
            }}
            onBlur={addCustom}
            placeholder={EXAMPLE.sizes}
            aria-label={t("products.page.customSize")}
            className={`${INPUT} w-40`}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={`${CHIP} border-dashed border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]`}>
            + {t("products.page.customSize")}
          </button>
        )}
        {sizes.length > 0 && (
          <button type="button" onClick={() => onChange([])} className={btn("ghost", "sm")}>{t("products.sizes.clear")}</button>
        )}
      </div>
      {sizes.length === 0 && <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">{t("products.page.sizesNone")}</p>}
    </div>
  );
}
