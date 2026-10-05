"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColorGroup, Product, StyleKeyword, CropData } from "@/lib/types";
import { STYLE_KEYWORD_LIST as STYLE_KEYWORDS, styleLabel } from "@/lib/style-keywords";
import { subcategoryToValue, resolveSubcategory } from "@/lib/categories";
import { useCategoryTree } from "@/lib/hooks/useCategoryTree";
import { ImageCropEditor } from "@/components/admin/ImageCropEditor";
import { useDownloadCards } from "@/components/admin/DownloadCardsButton";
import { DataTable, EmptyState, Thumb, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/admin/Badge";
import { PageHeader, PLUS } from "@/components/admin/PageHeader";
import { ActiveFilters, FilterBar, FilterChips, FilterMenu, SearchField, type ActiveFilter } from "@/components/admin/FilterBar";
import { BulkBar } from "@/components/admin/BulkBar";
import { RowMenu, type MenuItem } from "@/components/admin/Menu";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { BANNER, btn, BTN_ICON, BTN_ICON_SM, FIELD_LABEL, INPUT, SELECT } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT, type Key } from "@/app/goo-studio/_i18n";
import { Modal } from "@/components/admin/Modal";
import { categoryPath, DEFAULT_COLOR_GROUPS, GENDERS } from "./_editor/form";

/** A product's own page (GS6-1): the editor that used to be a modal here. */
const productHref = (id: string) => `/goo-studio/products/${id}`;

// Sort options shown in the admin toolbar dropdown. Each maps to a (key, direction) pair
// that drives the same sortKey/sortDir state used by the clickable column headers.
type SortColumn = "name" | "brand" | "category" | "priceMin" | "createdAt";
const SORT_OPTIONS: { value: string; label: Key }[] = [
  { value: "createdAt:desc", label: "products.sort.newest" },
  { value: "createdAt:asc", label: "products.sort.oldest" },
  { value: "name:asc", label: "products.sort.nameAsc" },
  { value: "name:desc", label: "products.sort.nameDesc" },
  { value: "brand:asc", label: "products.sort.brandAsc" },
  { value: "priceMin:asc", label: "products.sort.priceAsc" },
  { value: "priceMin:desc", label: "products.sort.priceDesc" },
];

/** A column's name, for a sort set from a header that has no named preset. */
const SORT_COLUMN_LABEL: Record<SortColumn, Key> = {
  name: "products.col.product",
  brand: "products.f.brand",
  category: "products.col.category",
  priceMin: "products.col.price",
  createdAt: "products.col.added",
};

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * The "show me what still needs filling in" filter.
 *
 * Sorting a catalogue out means finding the gaps, and a gap is invisible in a
 * list that only lets you filter by what a product *has*. Each entry answers
 * "which pieces are still missing this?".
 */
const MISSING_FILTERS: { value: string; label: Key; test: (p: Product) => boolean }[] = [
  { value: "subcategory", label: "products.missing.subcategory", test: (p) => !p.subcategory },
  { value: "colorGroups", label: "products.missing.colorGroups", test: (p) => !p.colorGroupIds?.length },
  { value: "colors", label: "products.missing.colors", test: (p) => !p.colors?.length },
  { value: "style", label: "products.missing.style", test: (p) => !p.styleKeywords?.length },
  { value: "gender", label: "products.missing.gender", test: (p) => !p.gender },
  { value: "description", label: "products.missing.description", test: (p) => !p.description?.trim() },
  { value: "sizes", label: "products.missing.sizes", test: (p) => !p.sizes?.length },
  { value: "image", label: "products.missing.image", test: (p) => !p.imageUrl?.trim() },
];

/**
 * Photo-backdrop sampling sizes. The sample is small enough to answer "how many
 * photos have a backdrop" in a few seconds; the batch is the most the API takes
 * in one call.
 */
const BACKDROP_SAMPLE = 40;
const BACKDROP_BATCH = 1000;

/**
 * How many batches one click will work through before handing back control.
 *
 * The point is not to need thirty clicks for a catalogue. It is bounded anyway,
 * because an unbounded loop against a job that has quietly stopped making
 * progress would spin forever — see the stall check in the loop itself.
 */
const BACKDROP_MAX_ROUNDS = 40;

// ── Types ──────────────────────────────────────────────────────────────────────

// ── Group-variants types ────────────────────────────────────────────────────

interface GroupEntry {
  id: string;
  colorHex: string;
  isPrimary: boolean;
}

interface GroupModalState {
  open: boolean;
  entries: GroupEntry[];      // products currently being configured
  existingGroupId?: string;   // set when editing an existing group
}

// ── Styles ─────────────────────────────────────────────────────────────────────

// The shared field recipes (_ui/recipes.ts), full width by default.
const inputCls = `${INPUT} w-full`;
// Width is not part of the base: a select that sets its own (the store's
// currency) would otherwise carry both w-full and its width, and w-full won —
// the currency took the row and squeezed the store price to a few pixels.
const selectBaseCls = SELECT;
const selectCls = `${selectBaseCls} w-full`;
const labelCls = FIELD_LABEL;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * A dictionary message with inline marks: `<b>…</b>` becomes <strong>, and a
 * `{name}` left unfilled becomes `code[name]` in code type. Messages are plain
 * strings, so the few sentences that stress a word or name a setting carry the
 * mark in the text, and each language puts it where its own word order needs.
 */
function rich(text: string, code: Record<string, string> = {}): ReactNode[] {
  return text.split(/(<b>.*?<\/b>|\{\w+\})/).map((part, i) => {
    if (part.startsWith("<b>")) return <strong key={i}>{part.slice(3, -4)}</strong>;
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (name && name in code) return <code key={i} className="font-mono">{code[name]}</code>;
    return part;
  });
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  // The tree the Categories page edits — the chips below are whatever it says.
  const categoryGroups = useCategoryTree();
  const subcatToValue = useMemo(() => subcategoryToValue(categoryGroups), [categoryGroups]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // Why the last catalogue load failed, or null. Kept until a load succeeds,
  // so a failure does not pass for an empty catalogue once the toast is gone.
  const [loadError, setLoadError] = useState<string | null>(null);
  /**
   * Whether the database is there to write to. Checked once on load: without
   * it the page says so once and every action that writes is disabled — there
   * is no in-memory mode pretending to save. `null` while the check runs.
   */
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const canWrite = dbConfigured === true;
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>(DEFAULT_COLOR_GROUPS);
  const [recategorizing, setRecategorizing] = useState(false);
  const [restyling, setRestyling] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const f = useFormat();

  const [filterGroup, setFilterGroup] = useState<string>("");
  const [filterSubcategory, setFilterSubcategory] = useState<string>("");
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [filterColorGroup, setFilterColorGroup] = useState<string>("");
  const [filterStyle, setFilterStyle] = useState<string>("");
  const [filterGender, setFilterGender] = useState<string>("");
  /** Which field to show only the products *missing* — see MISSING_FILTERS. */
  const [filterMissing, setFilterMissing] = useState<string>("");
  const [filterNew, setFilterNew] = useState<boolean | null>(null);
  // Default to newest-first so the table mirrors the DB order (created_at desc).
  const [sortKey, setSortKey] = useState<SortColumn>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Crop editor ────────────────────────────────────────────────────────────
  const [cropProduct, setCropProduct] = useState<Product | null>(null);
  const [cropSaving, setCropSaving] = useState(false);

  const handleCropSave = async (cropData: CropData) => {
    if (!cropProduct || !canWrite) return;
    setCropSaving(true);
    try {
      const res = await fetch(`/api/products/${cropProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropData }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.err(json.error ? t("crop.saveFailedWith", { error: json.error }) : t("crop.saveFailed"));
        return;
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === cropProduct.id ? { ...p, cropData } : p))
      );
      toast.ok(t("crop.saved"));
      setCropProduct(null);
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("crop.saveFailed"));
    } finally {
      setCropSaving(false);
    }
  };

  const handleCropClear = async (product: Product) => {
    if (!canWrite) return;
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropData: null }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.err(json.error ? t("crop.clearFailedWith", { error: json.error }) : t("crop.clearFailed"));
        return;
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, cropData: undefined } : p))
      );
      toast.ok(t("crop.cleared"));
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("crop.clearFailed"));
    }
  };

  // ── Group variants modal ───────────────────────────────────────────────────
  const [groupModal, setGroupModal] = useState<GroupModalState>({ open: false, entries: [] });
  const [grouping, setGrouping] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // raw=true returns all products including non-primary variants
      const res = await fetch("/api/products?raw=true");
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && typeof data === "object" && "error" in data && String(data.error)) || t("products.load.failedHttp", { status: String(res.status) }));
      }
      setProducts(data);
      setLoadError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("products.load.failed");
      setLoadError(message);
      toast.err(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Whether there is a database to write to — asked once, not on every
    // refetch (GET is read-only).
    fetch("/api/products/seed")
      .then((r) => setDbConfigured(r.status !== 501))
      .catch(() => toast.err(t("products.db.checkFailed")));
    fetchProducts();
    fetch("/api/color-groups")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setColorGroups(d); })
      .catch(() => {});
    // Mount-only load; fetchProducts is re-created each render and reads no props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filterGroup) {
      const values = categoryGroups.find((g) => g.id === filterGroup)?.items.map((i) => i.value) ?? [];
      list = list.filter((p) => values.includes(p.category));
    }
    if (filterSubcategory) {
      // Same forgiving rule as the catalog: a piece that records no
      // subcategory still answers to its whole category.
      list = list.filter((p) => {
        if (p.category !== subcatToValue[filterSubcategory]) return false;
        const sub = resolveSubcategory(p.category, p.subcategory, categoryGroups);
        return !sub || sub === filterSubcategory;
      });
    }
    if (filterBrand) list = list.filter((p) => p.brand === filterBrand);
    if (filterColorGroup) {
      const id = Number(filterColorGroup);
      list = list.filter((p) => p.colorGroupIds?.includes(id));
    }
    if (filterStyle) list = list.filter((p) => p.styleKeywords?.includes(filterStyle as StyleKeyword));
    if (filterGender) list = list.filter((p) => p.gender === filterGender);
    if (filterMissing) {
      const missing = MISSING_FILTERS.find((m) => m.value === filterMissing);
      if (missing) list = list.filter(missing.test);
    }
    if (filterNew !== null) list = list.filter((p) => p.isNew === filterNew);
    if (sortKey) {
      list = [...list].sort((a, b) => {
        let cmp: number;
        if (sortKey === "priceMin") {
          cmp = (a.priceMin ?? 0) - (b.priceMin ?? 0);
        } else if (sortKey === "createdAt") {
          // ISO date strings compare lexicographically; missing dates sort oldest.
          cmp = String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
        } else {
          cmp = String(a[sortKey] ?? "").toLowerCase().localeCompare(String(b[sortKey] ?? "").toLowerCase());
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [products, searchQuery, filterGroup, filterSubcategory, filterBrand, filterColorGroup, filterStyle, filterGender, filterMissing, filterNew, sortKey, sortDir, categoryGroups, subcatToValue]);

  // The Audit page links a suspect straight here by name, so the list opens
  // already narrowed to the piece being fixed.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search).get("search");
    if (search) setSearchQuery(search);
  }, []);

  /** Brands actually present in the catalogue, so the list can't offer a dead end. */
  const brandsInCatalogue = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  /**
   * What "Download cards" will draw: the selection when there is one, and
   * otherwise whatever the filters have narrowed the table to — the same
   * selection-or-the-rest rule the backdrop button follows.
   *
   * A list that is the entire catalogue goes as `null` instead, so exporting
   * everything stays a short request rather than a POST carrying ten thousand
   * ids the server is about to read out of its own table anyway.
   */
  const exportIds = useMemo(() => {
    if (selectedIds.size) return filtered.filter((p) => selectedIds.has(p.id)).map((p) => p.id);
    if (filtered.length === products.length) return null;
    return filtered.map((p) => p.id);
  }, [filtered, products, selectedIds]);

  const cards = useDownloadCards("products");

  /** Added in the last 30 days, for the header line. */
  const addedRecently = useMemo(() => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return products.filter((p) => p.createdAt && Date.parse(p.createdAt) >= since).length;
  }, [products]);

  /**
   * Category and subcategory are one filter with two levels, as in the
   * catalog: "g:<group>" or "s:<group>:<subcategory>".
   */
  const categoryValue = filterSubcategory
    ? `s:${filterGroup}:${filterSubcategory}`
    : filterGroup
      ? `g:${filterGroup}`
      : "";
  const categoryOptions = useMemo(
    () =>
      categoryGroups.flatMap((g) => [
        { value: `g:${g.id}`, label: g.label },
        ...g.items.map((item) => ({ value: `s:${g.id}:${item.label}`, label: item.label, nested: true })),
      ]),
    [categoryGroups],
  );
  const setCategoryValue = (v: string) => {
    if (!v) {
      setFilterGroup("");
      setFilterSubcategory("");
    } else if (v.startsWith("g:")) {
      setFilterGroup(v.slice(2));
      setFilterSubcategory("");
    } else {
      const [, group, ...sub] = v.split(":");
      setFilterGroup(group);
      setFilterSubcategory(sub.join(":"));
    }
  };

  const clearFilters = () => {
    setFilterGroup(""); setFilterSubcategory("");
    setFilterBrand(""); setFilterColorGroup(""); setFilterStyle(""); setFilterGender("");
    setFilterMissing(""); setFilterNew(null);
  };

  /** What narrows the list right now, as chips that each remove themselves. */
  const activeFilters: ActiveFilter[] = [
    ...(categoryValue
      ? [{ key: "category", label: `${t("products.f.category")}: ${categoryOptions.find((o) => o.value === categoryValue)?.label ?? filterSubcategory}`, onRemove: () => setCategoryValue("") }]
      : []),
    ...(filterBrand ? [{ key: "brand", label: `${t("products.f.brand")}: ${filterBrand}`, onRemove: () => setFilterBrand("") }] : []),
    ...(filterColorGroup
      ? [{ key: "color", label: `${t("products.f.color")}: ${colorGroups.find((g) => String(g.id) === filterColorGroup)?.name ?? filterColorGroup}`, onRemove: () => setFilterColorGroup("") }]
      : []),
    ...(filterStyle ? [{ key: "style", label: `${t("products.f.style")}: ${styleLabel(filterStyle as StyleKeyword)}`, onRemove: () => setFilterStyle("") }] : []),
    ...(filterGender
      ? [{ key: "gender", label: `${t("products.f.gender")}: ${t(GENDERS.find((g) => g.value === filterGender)?.label ?? "products.gender.unisex")}`, onRemove: () => setFilterGender("") }]
      : []),
    ...(filterNew ? [{ key: "status", label: `${t("products.f.status")}: ${t("products.badge.new")}`, onRemove: () => setFilterNew(null) }] : []),
    ...(filterMissing
      ? [{ key: "missing", label: `${t("products.f.missing")}: ${t(MISSING_FILTERS.find((m) => m.value === filterMissing)?.label ?? "products.missing.image")}`, onRemove: () => setFilterMissing("") }]
      : []),
  ];

  /** Back to the first page whenever the list itself changes. */
  const tableResetKey = [searchQuery, categoryValue, filterBrand, filterColorGroup, filterStyle, filterGender, filterMissing, String(filterNew), sortKey, sortDir].join("|");

  const handleDelete = async (id: string) => {
    if (!canWrite) return;
    if (!(await confirm({ title: t("products.delete.title"), confirmLabel: t("products.delete.action"), tone: "danger" }))) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        // 409 names the outfits that still use it; the row stays.
        const json = await res.json().catch(() => ({}));
        toast.err(json.error || t("products.delete.failedHttp", { status: String(res.status) }));
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.ok(t("products.delete.done"));
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.delete.failed"));
    }
  };

  /* ── Bulk edit: one set of changes across a selection ─────────────────── */

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  /** Every field starts blank, and a blank field is left alone. */
  const [bulk, setBulk] = useState({
    brand: "",
    gender: "",
    subcategory: "",
    styleKeywords: [] as StyleKeyword[],
    styleMode: "add" as "add" | "replace",
    colorGroupIds: [] as number[],
    colorMode: "add" as "add" | "replace",
    namePrefix: "",
    nameSuffix: "",
    nameFind: "",
    nameReplace: "",
  });

  const resetBulk = () => setBulk({
    brand: "", gender: "", subcategory: "",
    styleKeywords: [], styleMode: "add",
    colorGroupIds: [], colorMode: "add",
    namePrefix: "", nameSuffix: "", nameFind: "", nameReplace: "",
  });

  /** A list field is either added to or replaced wholesale. */
  const bulkModeOptions = [
    { value: "add", label: t("products.bulkEdit.mode.add") },
    { value: "replace", label: t("products.bulkEdit.mode.replace") },
  ];

  const bulkChangeCount =
    (bulk.brand.trim() ? 1 : 0) +
    (bulk.gender ? 1 : 0) +
    (bulk.subcategory ? 1 : 0) +
    (bulk.styleKeywords.length ? 1 : 0) +
    (bulk.colorGroupIds.length ? 1 : 0) +
    (bulk.namePrefix || bulk.nameSuffix || bulk.nameFind ? 1 : 0);

  const applyBulkEdit = async () => {
    const ids = [...selectedIds];
    if (!ids.length || !bulkChangeCount) return;

    const set: Record<string, unknown> = {};
    const add: Record<string, unknown> = {};
    if (bulk.brand.trim()) set.brand = bulk.brand.trim();
    if (bulk.gender) set.gender = bulk.gender;
    if (bulk.subcategory) set.subcategory = bulk.subcategory;
    if (bulk.styleKeywords.length) {
      (bulk.styleMode === "replace" ? set : add).styleKeywords = bulk.styleKeywords;
    }
    if (bulk.colorGroupIds.length) {
      (bulk.colorMode === "replace" ? set : add).colorGroupIds = bulk.colorGroupIds;
    }

    const gender = GENDERS.find((g) => g.value === bulk.gender);
    const summary = [
      bulk.brand.trim() && t("products.bulkEdit.sum.brand", { value: bulk.brand.trim() }),
      bulk.gender && t("products.bulkEdit.sum.gender", { value: gender ? t(gender.label) : bulk.gender }),
      bulk.subcategory && t("products.bulkEdit.sum.subcategory", { value: bulk.subcategory }),
      bulk.styleKeywords.length &&
        t(bulk.styleMode === "replace" ? "products.bulkEdit.sum.stylesReplace" : "products.bulkEdit.sum.stylesAdd", {
          list: bulk.styleKeywords.join(", "),
        }),
      bulk.colorGroupIds.length &&
        t(bulk.colorMode === "replace" ? "products.bulkEdit.sum.colorsReplace" : "products.bulkEdit.sum.colorsAdd", {
          count: bulk.colorGroupIds.length,
        }),
      bulk.nameFind && t("products.bulkEdit.sum.rename", { find: bulk.nameFind, replace: bulk.nameReplace }),
      bulk.namePrefix && t("products.bulkEdit.sum.prefix", { value: bulk.namePrefix }),
      bulk.nameSuffix && t("products.bulkEdit.sum.suffix", { value: bulk.nameSuffix }),
    ].filter(Boolean).join("\n  ");

    if (
      !(await confirm({
        title: t("products.bulkEdit.confirmTitle", { count: ids.length }),
        body: `  ${summary}\n\n${t("products.bulkEdit.confirmNote")}`,
        confirmLabel: t("products.bulkEdit.confirmAction", { count: ids.length }),
        tone: "danger",
      }))
    ) return;

    setBulkSaving(true);
    try {
      const res = await fetch("/api/products/bulk-edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          set,
          add,
          name: {
            prefix: bulk.namePrefix,
            suffix: bulk.nameSuffix,
            find: bulk.nameFind,
            replace: bulk.nameReplace,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.err(json.error ?? t("products.bulkEdit.failed")); return; }
      const failed = (json.failures ?? []).length;
      (failed ? toast.err : toast.ok)(
        failed
          ? t("products.bulkEdit.partial", { updated: json.updated, requested: json.requested, failed })
          : t("products.bulkEdit.done", { count: json.updated }),
      );
      setBulkOpen(false);
      resetBulk();
      setSelectedIds(new Set());
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.bulkEdit.failed"));
    } finally {
      setBulkSaving(false);
    }
  };

  // Re-run the category classifier over EVERY product already in the DB (the
  // import fix only affects new imports). Dry-run first, show what would change,
  // and only write after the admin confirms. scope=all re-evaluates the whole
  // catalog, not just the accessories bucket.
  const handleRecategorize = async () => {
    setRecategorizing(true);
    try {
      const dryRes = await fetch("/api/admin/recategorize?scope=all", { cache: "no-store" });
      const dry = await dryRes.json();
      if (!dryRes.ok) { toast.err(dry.error || t("products.fix.failed")); return; }

      // Products the classifier left alone, and why. Worth stating up front:
      // the whole worry about this button is that it overwrites hand-filed work,
      // and the answer is that it refuses to look at it.
      const guarded = (dry.skippedBreakdown ?? []) as { reason: string; explanation: string; count: number }[];
      const guardNote = guarded
        .filter((g) => g.count > 0)
        .map((g) => `  ${t("products.fix.untouched", { count: g.count, reason: g.explanation })}`)
        .join("\n");

      if (!dry.wouldChange) {
        toast.ok(dry.protected ? t("products.fix.protected", { count: dry.protected }) : t("products.fix.allCorrect"));
        if (guardNote) toast.info(`${t("products.fix.noChanges")}\n\n${guardNote}`);
        return;
      }

      const summary = Object.entries(dry.breakdown as Record<string, number>)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `  ${k}: ${f.number(n)}`)
        .join("\n");
      const ok = await confirm({
        title: t("products.fix.confirmTitle", { changed: dry.wouldChange, count: dry.scanned }),
        body: `${summary}\n\n${guardNote ? `${guardNote}\n\n` : ""}${t("products.fix.confirmBody")}`,
        confirmLabel: t("products.fix.confirmAction", { count: dry.wouldChange }),
      });
      if (!ok) return;

      const applyRes = await fetch("/api/admin/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, scope: "all" }),
      });
      const applied = await applyRes.json();
      if (!applyRes.ok) { toast.err(applied.error || t("products.applyFailed")); return; }
      (applied.undoable ? toast.ok : toast.err)(
        t(applied.undoable ? "products.fix.done" : "products.fix.notRecorded", { count: applied.applied }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.fix.failed"));
    } finally {
      setRecategorizing(false);
    }
  };

  /** Puts back whatever the last "Fix categories" run changed. */
  const handleUndoRecategorize = async () => {
    if (
      !(await confirm({
        title: t("products.fix.undoTitle"),
        body: t("products.undo.since"),
        confirmLabel: t("products.fix.undoAction"),
      }))
    ) return;
    setRecategorizing(true);
    try {
      const res = await fetch("/api/admin/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      const json = await res.json();
      if (!res.ok) { toast.err(json.error || t("products.undo.nothing")); return; }
      toast.ok(
        json.movedSince
          ? t("products.undo.restoredSome", { restored: json.restored, changed: json.movedSince })
          : t("products.undo.restored", { count: json.restored }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.undo.failed"));
    } finally {
      setRecategorizing(false);
    }
  };

  // Takes every style tag off the catalogue and gives products only the five
  // basic styles, read afresh from their own words; curated looks lose theirs.
  // Dry run first, the admin confirms the numbers, then it writes — and the
  // run is recorded, so Undo styles puts the old tags back.
  const handleResetStyles = async () => {
    setRestyling(true);
    try {
      const dryRes = await fetch("/api/admin/restyle", { cache: "no-store" });
      const dry = await dryRes.json();
      if (!dryRes.ok) { toast.err(dry.error || t("products.styles.failed")); return; }

      const would = dry.wouldChange as { products: number; outfits: number };
      if (!would.products && !would.outfits) {
        toast.ok(t("products.styles.nothing"));
        return;
      }

      const after = Object.entries(dry.after as Record<string, number>)
        .map(([style, n]) => `  ${style === "none" ? t("products.styles.none") : style}: ${f.number(n)}`)
        .join("\n");
      const removed = Object.entries(dry.removed as Record<string, number>)
        .sort((a, b) => b[1] - a[1])
        .map(([style, n]) => `${style} ${f.number(n)}`)
        .join(", ");
      // Two clauses, each agreeing with its own number, so a language can
      // join them in its own order.
      const productsClause = t("products.styles.confirmProducts", { changed: would.products, count: dry.scanned.products });
      const ok = await confirm({
        title: would.outfits
          ? t("products.styles.confirmTitleBoth", {
              products: productsClause,
              outfits: t("products.styles.confirmOutfits", { count: would.outfits }),
            })
          : t("products.styles.confirmTitle", { products: productsClause }),
        body:
          `${t("products.styles.confirmBody")}\n\n` +
          `${t("products.styles.perStyle")}\n${after}\n\n` +
          (removed ? `${t("products.styles.removedTags", { list: removed })}\n\n` : "") +
          t("products.canUndo"),
        confirmLabel: t("products.styles.confirmAction", { count: would.products }),
        tone: "danger",
      });
      if (!ok) return;

      const applyRes = await fetch("/api/admin/restyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true }),
      });
      const applied = await applyRes.json();
      if (!applyRes.ok) { toast.err(applied.error || t("products.applyFailed")); return; }
      const failed = (applied.failures ?? []).length;
      (applied.undoable && !failed ? toast.ok : toast.err)(
        applied.undoable
          ? [
              t("products.styles.done", { count: applied.applied }),
              ...(failed ? [t("products.failedCount", { count: failed })] : []),
              t("products.styles.undoHint"),
            ].join(" · ")
          : t("products.styles.notRecorded", { count: applied.applied }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.styles.failed"));
    } finally {
      setRestyling(false);
    }
  };

  /** Puts back the tags the last style reset replaced. */
  const handleUndoResetStyles = async () => {
    if (
      !(await confirm({
        title: t("products.styles.undoTitle"),
        body: t("products.styles.undoBody"),
        confirmLabel: t("products.styles.undoAction"),
      }))
    ) return;
    setRestyling(true);
    try {
      const res = await fetch("/api/admin/restyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      const json = await res.json();
      if (!res.ok) { toast.err(json.error || t("products.undo.nothing")); return; }
      toast.ok(
        json.changedSince
          ? t("products.undo.restoredSome", { restored: json.restored, changed: json.changedSince })
          : t("products.styles.restored", { count: json.restored }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.undo.failed"));
    } finally {
      setRestyling(false);
    }
  };

  /**
   * Measures the backdrop each product photo was shot on, so cards can pad with
   * that instead of with white.
   *
   * Runs in batches because it downloads images: one pass over the whole
   * catalogue would outlast any request. Clicking again picks up where it left
   * off — nothing is measured twice.
   *
   * The dry run deliberately covers a sample rather than everything. It exists
   * to answer "how many photos actually have a backdrop", which is a rate, and
   * measuring a rate over forty photos costs forty downloads instead of ten
   * thousand.
   */
  const handleSampleBackdrops = async () => {
    setSampling(true);
    try {
      const chosenIds = selectedIds.size ? [...selectedIds] : [];

      const post = (body: Record<string, unknown>) =>
        fetch("/api/admin/product-bg-color", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

      if (!chosenIds.length) {
        const progressRes = await fetch("/api/admin/product-bg-color", { cache: "no-store" });
        const p = await progressRes.json();
        if (!progressRes.ok) { toast.err(p.error || t("products.bd.progressFailed")); return; }
        if (p.progress.total && !p.progress.unmeasured) {
          toast.ok(
            t("products.bd.allMeasured", {
              total: p.progress.total,
              measured: p.progress.measured,
              declined: p.progress.declined,
            }),
          );
          return;
        }
      }

      const dryRes = await post({ limit: BACKDROP_SAMPLE, ids: chosenIds });
      const dry = await dryRes.json();
      if (!dryRes.ok) { toast.err(dry.error || t("products.bd.failed")); return; }

      if (!dry.scanned) { toast.ok(t("products.bd.nothingLeft")); return; }

      const examples = (dry.measuredSample as { name: string; color: string }[])
        .slice(0, 6)
        .map((m) => `  ${m.color}  ${m.name}`)
        .join("\n");
      const whyNot = (dry.declinedSample as { reason: string }[])
        .reduce((acc: Record<string, number>, d) => {
          // Strip the measured numbers out of the reason so the tally groups.
          const kind = d.reason.replace(/\s*\([^)]*\)/, "");
          acc[kind] = (acc[kind] ?? 0) + 1;
          return acc;
        }, {});
      const whyNotNote = Object.entries(whyNot)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, n]) => `  ${f.number(n)} — ${reason}`)
        .join("\n");

      const remaining = (dry.progress?.unmeasured ?? dry.scanned) as number;
      const ok = await confirm({
        title: chosenIds.length
          ? t("products.bd.confirmSelected", { count: dry.scanned })
          : t("products.bd.confirmAll", { count: remaining }),
        body:
          `${t("products.bd.measuredDry", { count: dry.scanned })}\n\n` +
          `  ${t("products.bd.single", { count: dry.measured })}\n` +
          `  ${t("products.bd.none", { count: dry.declined })}\n` +
          (dry.failed ? `  ${t("products.bd.downloadFailed", { count: dry.failed })}\n` : "") +
          (examples ? `\n${examples}\n` : "") +
          (whyNotNote ? `\n${t("products.bd.whyDeclined")}\n${whyNotNote}\n` : "") +
          `\n${t("products.canUndo")}`,
        confirmLabel: chosenIds.length
          ? t("products.bd.confirmSaveSelected", { count: dry.scanned })
          : t("products.bd.confirmSaveAll", { count: remaining }),
      });
      if (!ok) return;

      // One click works through the catalogue rather than one batch of it. The
      // loop is bounded two ways: a round cap, and a stall check — if a round
      // saves nothing, either everything left is failing to download or the
      // writes are failing, and calling again would only repeat that. It counts
      // what was written, not what was measured: a measurement the database
      // refused is not progress.
      let rounds = 0;
      let totalMeasured = 0;
      let totalDeclined = 0;
      let totalFailed = 0;
      let totalApplied = 0;
      let totalWriteFailures = 0;
      let lastWriteError = "";
      let thumbnails = 0;
      let notRecorded = false;
      let left: number | undefined;
      // A round the server refused ends the run; it goes into the summary
      // below rather than a toast of its own the summary would replace.
      let roundError = "";

      while (rounds < BACKDROP_MAX_ROUNDS) {
        rounds++;
        const res = await post({
          apply: true,
          limit: chosenIds.length ? BACKDROP_SAMPLE : BACKDROP_BATCH,
          ids: chosenIds,
        });
        const round = await res.json().catch(() => ({}));
        if (!res.ok) {
          roundError = round.error || t("products.applyFailedHttp", { status: String(res.status) });
          break;
        }

        const applied = (round.applied ?? 0) as number;
        const writeFailures = (round.writeFailures ?? []) as { id: string; error: string }[];
        totalMeasured += round.measured ?? 0;
        totalDeclined += round.declined ?? 0;
        totalFailed = round.failed ?? 0;
        totalApplied += applied;
        totalWriteFailures += writeFailures.length;
        if (writeFailures.length) lastWriteError = writeFailures[0].error;
        thumbnails += round.viaThumbnail ?? 0;
        if (round.undoable === false && applied > 0) notRecorded = true;
        // Null when the progress count failed after a successful write — say
        // nothing about what is left rather than guessing at it.
        left = round.progress?.unmeasured as number | undefined;

        if (chosenIds.length || left === undefined || left === 0 || applied === 0) break;

        toast.ok(t("products.bd.progress", { saved: totalApplied, left }));
      }

      const failedWrites = totalWriteFailures > 0;
      (roundError || notRecorded || failedWrites ? toast.err : toast.ok)(
        (roundError ? `${t("products.bd.stopped", { error: roundError })} · ` : "") +
        t("products.bd.summary", { saved: totalApplied, measured: totalMeasured, declined: totalDeclined }) +
        (totalFailed ? ` · ${t("products.bd.toRetry", { count: totalFailed })}` : "") +
        (failedWrites ? ` · ${t("products.bd.notSaved", { count: totalWriteFailures, error: lastWriteError })}` : "") +
        (left === undefined ? "" : ` · ${left ? t("products.bd.leftClickAgain", { count: left }) : t("products.bd.allDone")}`) +
        // Worth saying: without renditions every photo came at full size, which
        // is the difference between a minute and an hour on a large catalogue.
        (totalMeasured && !thumbnails ? ` — ${t("products.bd.fullSize")}` : "") +
        (notRecorded ? ` — ${t("products.bd.notRecorded")}` : ""),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.bd.failed"));
    } finally {
      setSampling(false);
    }
  };

  /** Clears whatever the last backdrop run wrote. */
  const handleUndoBackdrops = async () => {
    if (
      !(await confirm({
        title: t("products.bd.undoTitle"),
        body: t("products.undo.since"),
        confirmLabel: t("products.bd.undoAction"),
      }))
    ) return;
    setSampling(true);
    try {
      const res = await fetch("/api/admin/product-bg-color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      const json = await res.json();
      if (!res.ok) { toast.err(json.error || t("products.undo.nothing")); return; }
      toast.ok(
        json.changedSince
          ? t("products.bd.clearedSome", { restored: json.restored, changed: json.changedSince })
          : t("products.bd.cleared", { count: json.restored }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.undo.failed"));
    } finally {
      setSampling(false);
    }
  };

  // ── Sort / select helpers ───────────────────────────────────────────────────

  const toggleSort = (key: SortColumn) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "createdAt" ? "desc" : "asc"); }
  };

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  // Keep the Sort dropdown in sync with column-header clicks. If a header produced a
  // (key, dir) combo that isn't a named preset (e.g. Category ↓), surface it as an option
  // so the <select> always reflects the active sort instead of falling back to the first item.
  const currentSortValue = `${sortKey}:${sortDir}`;
  const sortOptions = [
    ...SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) })),
    ...(SORT_OPTIONS.some((o) => o.value === currentSortValue)
      ? []
      : [{ value: currentSortValue, label: `${t(SORT_COLUMN_LABEL[sortKey])} ${sortDir === "asc" ? "↑" : "↓"}` }]),
  ];

  /**
   * Select a row, and with Shift held, everything between it and the row
   * clicked before it.
   *
   * The anchor is the last row whose checkbox was used, held in a ref because
   * it steers the next click rather than anything on screen — re-rendering the
   * table for it would be work for nothing.
   *
   * The range takes the state the clicked row is moving *to*, so shift-clicking
   * also clears a run: the gesture that selects fifty rows undoes them the same
   * way, instead of only ever adding.
   */
  const rangeAnchor = useRef<string | null>(null);

  // A selection dragged out of the bulk-edit form must not close it.

  const toggleSelect = (id: string, extendRange = false) => {
    // Read the anchor here, not inside the updater. React runs the updater at
    // render time, by which point the assignment below has already moved the
    // anchor to this row — so the updater would compare the row against itself,
    // find `anchor === id`, and quietly fall through to a plain toggle. That is
    // exactly the bug this had: Shift was detected, and nothing extended.
    const anchor = rangeAnchor.current;
    rangeAnchor.current = id;

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (extendRange && anchor && anchor !== id) {
        const ids = filtered.map((p) => p.id);
        const from = ids.indexOf(anchor);
        const to = ids.indexOf(id);
        // A filter or sort change can leave the anchor off the current list.
        // Falling through to the plain toggle is the honest answer then.
        if (from !== -1 && to !== -1) {
          const selecting = !prev.has(id);
          for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
            if (selecting) next.add(ids[i]); else next.delete(ids[i]);
          }
          return next;
        }
      }

      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    rangeAnchor.current = null;
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));
  };

  const openGroupModal = () => {
    const selected = filtered.filter((p) => selectedIds.has(p.id));
    if (selected.length < 2) return;
    // Detect if all selected are already in the same group
    const groupIds = [...new Set(selected.map((p) => p.variantGroupId).filter(Boolean))];
    const existingGroupId = groupIds.length === 1 ? (groupIds[0] as string) : undefined;
    setGroupModal({
      open: true,
      existingGroupId,
      entries: selected.map((p, i) => ({
        id: p.id,
        colorHex: p.colorHex ?? "#888888",
        isPrimary: existingGroupId ? !!p.isGroupPrimary : i === 0,
      })),
    });
  };

  const handleGroupSave = async () => {
    if (!canWrite) return;
    const { entries, existingGroupId } = groupModal;
    const primaryEntry = entries.find((e) => e.isPrimary) ?? entries[0];
    setGrouping(true);
    try {
      const colorHexMap: Record<string, string> = {};
      entries.forEach((e) => { colorHexMap[e.id] = e.colorHex; });
      const res = await fetch("/api/products/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: entries.map((e) => e.id),
          primaryId: primaryEntry.id,
          colorHexMap,
          groupId: existingGroupId,
        }),
      });
      if (!res.ok) {
        // Includes a database without the variant columns: the message says
        // which columns to add.
        const err = await res.json().catch(() => ({}));
        toast.err(err.error || t("products.group.failedHttp", { status: String(res.status) }));
        return;
      }
      toast.ok(t("products.group.done", { count: entries.length }));
      setGroupModal({ open: false, entries: [] });
      setSelectedIds(new Set());
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.group.failed"));
    } finally {
      setGrouping(false);
    }
  };

  const handleUngroup = async (groupId: string) => {
    if (!canWrite) return;
    if (
      !(await confirm({
        title: t("products.group.unlinkTitle"),
        confirmLabel: t("products.group.unlinkAction"),
        tone: "danger",
      }))
    ) return;
    try {
      const res = await fetch("/api/products/group", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.err(err.error || t("products.group.unlinkFailedHttp", { status: String(res.status) }));
        return;
      }
      toast.ok(t("products.group.unlinked"));
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.group.unlinkFailed"));
    }
  };

  /**
   * Deletes the selection one product at a time and reports what actually
   * went: only rows the server deleted leave the table, and the ones it
   * refused — a product still used in an outfit, say — stay selected, with
   * the reason in the toast.
   */
  const handleBulkDelete = async () => {
    if (!selectedIds.size || !canWrite) return;
    const ids = [...selectedIds];
    const count = ids.length;
    if (
      !(await confirm({
        title: t("products.bulkDelete.title", { count }),
        body: t("products.bulkDelete.body"),
        confirmLabel: t("products.bulkDelete.action", { count }),
        tone: "danger",
      }))
    ) return;
    setDeleting(true);
    try {
      const failures: { id: string; error: string }[] = [];
      const deleted: string[] = [];
      // A few at a time rather than hundreds of requests at once.
      for (let i = 0; i < ids.length; i += 8) {
        await Promise.all(ids.slice(i, i + 8).map(async (id) => {
          try {
            const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
            if (res.ok) { deleted.push(id); return; }
            const json = await res.json().catch(() => ({}));
            failures.push({ id, error: (json.error as string) || `HTTP ${res.status}` });
          } catch (e) {
            failures.push({ id, error: e instanceof Error ? e.message : t("common.networkError") });
          }
        }));
      }
      const gone = new Set(deleted);
      setProducts((prev) => prev.filter((p) => !gone.has(p.id)));
      setSelectedIds(new Set(failures.map((f) => f.id)));
      if (failures.length) {
        const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? id;
        const shown = failures.slice(0, 3).map((f) => `${nameOf(f.id)}: ${f.error}`).join(" · ");
        toast.err(
          t("products.bulkDelete.partial", { deleted: deleted.length, total: count, list: shown }) +
          (failures.length > 3 ? ` (${t("products.bulkDelete.more", { count: failures.length - 3 })})` : ""),
        );
      } else {
        toast.ok(t("products.bulkDelete.done", { count }));
      }
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.bulkDelete.failed"));
    } finally {
      setDeleting(false);
    }
  };

  /** Which way a column header's arrows point: its direction when it is the sort. */
  const sortDirFor = (col: SortColumn) => (sortKey === col ? sortDir : null);

  // ── Header menu, row menu, columns ─────────────────────────────────────────

  /** What a maintenance run is busy with, shown beside the header buttons. */
  const maintenanceBusy = recategorizing
    ? t("products.busy.categories")
    : restyling
      ? t("products.busy.styles")
      : sampling
        ? t("products.busy.backdrops")
        : cards.busy
          ? cards.received
            ? t("products.busy.downloadMb", { mb: (cards.received / (1024 * 1024)).toFixed(1) })
            : t("products.busy.download")
          : null;

  const maintenanceItems: MenuItem[] = [
    { kind: "label", label: t("products.maintenance") },
    {
      label: t("products.mt.fixCategories"),
      hint: t("products.mt.fixCategoriesHint"),
      onSelect: handleRecategorize,
      disabled: recategorizing || !canWrite,
    },
    { label: t("products.mt.undoFix"), onSelect: handleUndoRecategorize, disabled: recategorizing || !canWrite },
    { kind: "separator" },
    {
      label: t("products.mt.resetStyles"),
      hint: t("products.mt.resetStylesHint"),
      onSelect: handleResetStyles,
      disabled: restyling || !canWrite,
    },
    { label: t("products.mt.undoStyles"), onSelect: handleUndoResetStyles, disabled: restyling || !canWrite },
    { kind: "separator" },
    {
      label: t("products.mt.backdrops"),
      // Works on the selection when there is one, otherwise on the next batch
      // of never-measured products.
      hint: selectedIds.size
        ? t("products.mt.backdropsSelected", { count: selectedIds.size })
        : t("products.mt.backdropsHint"),
      onSelect: handleSampleBackdrops,
      disabled: sampling || !canWrite,
    },
    { label: t("products.mt.undoBackdrops"), onSelect: handleUndoBackdrops, disabled: sampling || !canWrite },
    { kind: "separator" },
    {
      label: t("products.mt.download"),
      // The selection, else what the filters left, else the whole catalogue.
      hint: t("products.mt.downloadHint", { count: exportIds ? exportIds.length : products.length }),
      onSelect: () => void cards.download(exportIds),
      disabled: cards.busy || (exportIds ? exportIds.length : products.length) === 0,
    },
  ];

  const rowItems = (product: Product): MenuItem[] => [
    // Also an icon beside the menu; on a phone the icon gives its room to the name.
    { label: t("products.row.editShort"), onSelect: () => router.push(productHref(product.id)) },
    { label: t(product.cropData ? "crop.edit" : "crop.setUp"), onSelect: () => setCropProduct(product), disabled: !canWrite },
    { label: t("products.row.download"), onSelect: () => void cards.download([product.id]), disabled: cards.busy },
    { label: t("products.row.duplicate"), onSelect: () => router.push(`/goo-studio/products/new?from=${product.id}`), disabled: !canWrite },
    ...(product.variantGroupId && canWrite
      ? [{ label: t("products.row.unlink"), onSelect: () => handleUngroup(product.variantGroupId!) }]
      : []),
    { kind: "separator" },
    { label: t("products.row.delete"), onSelect: () => handleDelete(product.id), tone: "danger", disabled: !canWrite },
  ];

  const sortFor = (col: SortColumn) => ({ dir: sortDirFor(col), onToggle: () => toggleSort(col) });

  const productColumns: Column<Product>[] = [
    {
      key: "product",
      header: t("products.col.product"),
      grow: true,
      sort: sortFor("name"),
      cell: (p) => (
        <div className="flex items-center gap-3 min-w-0">
          <Thumb src={p.imageUrl} bg={p.bgColor} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium truncate" title={p.name}>
                {p.name}
              </span>
              {p.isNew && <Badge>{t("products.badge.new")}</Badge>}
              {/* The variant's own swatch as the dot, rather than Badge's
                  `dot`, which takes the text color. */}
              {p.variantGroupId && (
                <Badge>
                  {t(p.isGroupPrimary ? "products.badge.primary" : "products.badge.variant")}
                  {p.colorHex && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.colorHex }} aria-hidden="true" />}
                </Badge>
              )}
            </div>
            <div className="text-[12px] text-[var(--foreground-muted)] truncate">{p.brand}</div>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: t("products.col.category"),
      hide: "md",
      sort: sortFor("category"),
      cell: (p) => <span className="text-[var(--foreground-muted)]">{categoryPath(p.category, p.subcategory, categoryGroups)}</span>,
    },
    {
      key: "price",
      header: t("products.col.price"),
      align: "right",
      sort: sortFor("priceMin"),
      cell: (p) => f.moneyRange(p.priceMin, p.priceMax),
    },
    {
      key: "stores",
      header: t("products.col.stores"),
      align: "right",
      hide: "lg",
      cell: (p) => <span className="text-[var(--foreground-muted)]">{f.number(p.retailers?.length ?? 0)}</span>,
    },
    {
      key: "added",
      header: t("products.col.added"),
      hide: "md",
      sort: sortFor("createdAt"),
      cell: (p) => <span className="text-[var(--foreground-muted)]">{f.date(p.createdAt)}</span>,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* DB status banner — the one place a missing database is explained;
          every action that writes is disabled below it. */}
      {dbConfigured === false && (
        <div role="alert" className={`${BANNER.err} mb-4`}>
          <strong>{t("products.db.title")}</strong>{" "}
          {rich(t("products.db.hint"), { url: "SUPABASE_URL", key: "SUPABASE_SERVICE_ROLE_KEY" })}
        </div>
      )}

      {/* Header: what there is, the one main action, and the rest under "…".
          The catalogue maintenance runs (GS1-12) live in that menu; each one
          still does its dry run and asks with the number it will touch. */}
      <PageHeader
        title={t("nav.products")}
        subtitle={
          !loadError && !loading ? `${t("products.count", { count: products.length })} · ${t("products.recent", { count: addedRecently })}` : undefined
        }
        status={maintenanceBusy}
        actions={[{ key: "import", label: t("products.import"), href: "/goo-studio/import" }]}
        primary={{
          key: "add",
          label: t("products.add"),
          icon: PLUS,
          href: "/goo-studio/products/new",
          disabled: !canWrite,
          title: canWrite ? undefined : t("products.needsDb"),
        }}
        menu={maintenanceItems}
        menuLabel={t("products.maintenance")}
      />

      {/* Search and filters (FilterBar): one button per field, the active ones
          again as chips under the row, and the count. */}
      <div className="mb-4 flex flex-col gap-2.5">
        <FilterBar
          search={
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t("products.search.placeholder")}
              label={t("products.search.label")}
            />
          }
          active={activeFilters.length}
          onClearAll={clearFilters}
          shown={filtered.length}
        >
          <FilterMenu
            label={t("products.f.category")}
            value={categoryValue}
            options={categoryOptions}
            onChange={setCategoryValue}
            allLabel={t("filter.all")}
            searchable
          />
          <FilterMenu
            label={t("products.f.brand")}
            value={filterBrand}
            options={brandsInCatalogue.map((b) => ({ value: b, label: b }))}
            onChange={setFilterBrand}
            allLabel={t("filter.all")}
            searchable
          />
          <FilterMenu
            label={t("products.f.color")}
            value={filterColorGroup}
            options={colorGroups.map((g) => ({ value: String(g.id), label: g.name }))}
            onChange={setFilterColorGroup}
            allLabel={t("filter.all")}
          />
          <FilterMenu
            label={t("products.f.style")}
            value={filterStyle}
            options={STYLE_KEYWORDS.map((s) => ({ value: s, label: styleLabel(s) }))}
            onChange={setFilterStyle}
            allLabel={t("filter.all")}
          />
          <FilterMenu
            label={t("products.f.gender")}
            value={filterGender}
            options={GENDERS.map((g) => ({ value: g.value, label: t(g.label) }))}
            onChange={setFilterGender}
            allLabel={t("filter.all")}
          />
          <FilterMenu
            label={t("products.f.status")}
            value={filterNew ? "new" : ""}
            options={[{ value: "new", label: t("products.badge.new") }]}
            onChange={(v) => setFilterNew(v === "new" ? true : null)}
            allLabel={t("filter.all")}
          />
          {/* The gaps: filtering by what a product has cannot find what it is
              missing, which is most of the work when tidying a catalogue. */}
          <FilterMenu
            label={t("products.f.missing")}
            value={filterMissing}
            options={MISSING_FILTERS.map((m) => ({ value: m.value, label: t(m.label) }))}
            onChange={setFilterMissing}
            allLabel={t("products.f.missingNone")}
            tone="warn"
          />
        </FilterBar>
        {!loading && !loadError && (
          <ActiveFilters
            filters={activeFilters}
            onClearAll={clearFilters}
            count={t("filter.count", { shown: filtered.length, total: products.length })}
            trailing={
              <FilterMenu
                label={t("filter.sort")}
                value={currentSortValue}
                options={sortOptions}
                onChange={(v) => {
                  const [key, dir] = v.split(":") as [SortColumn, "asc" | "desc"];
                  setSortKey(key);
                  setSortDir(dir);
                }}
                variant="ghost"
                align="end"
              />
            }
          />
        )}
      </div>

      {/* Bulk edit modal */}
      {bulkOpen && (
        <Modal
          onClose={() => setBulkOpen(false)}
          label={t("products.bulk.edit")}
          panelClassName="w-full max-w-xl max-h-[90dvh] md:max-h-[85vh] overflow-y-auto rounded-2xl shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-[var(--border)]">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {t("products.bulkEdit.title", { count: selectedIds.size })}
              </h2>
              <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                {t("products.bulkEdit.hint")}
              </p>
            </div>
            <button onClick={() => setBulkOpen(false)} aria-label={t("common.close")} title={t("common.close")} className={`${BTN_ICON} shrink-0`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="px-4 md:px-6 py-5 flex flex-col gap-5">
            {/* Brand + gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("products.f.brand")}</label>
                <input
                  list="bulk-brands"
                  value={bulk.brand}
                  onChange={(e) => setBulk((b) => ({ ...b, brand: e.target.value }))}
                  placeholder={t("products.bulkEdit.keepBlank")}
                  className={inputCls}
                />
                <datalist id="bulk-brands">
                  {brandsInCatalogue.map((b) => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>{t("products.f.gender")}</label>
                <select value={bulk.gender} onChange={(e) => setBulk((b) => ({ ...b, gender: e.target.value }))} className={selectCls}>
                  <option value="">{t("products.bulkEdit.keep")}</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>{t(g.label)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subcategory — sets the category with it */}
            <div>
              <label className={labelCls}>{t("products.field.subcategory")}</label>
              <select
                value={bulk.subcategory}
                onChange={(e) => setBulk((b) => ({ ...b, subcategory: e.target.value }))}
                className={selectCls}
              >
                <option value="">{t("products.bulkEdit.keep")}</option>
                {categoryGroups.map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {g.items.map((i) => <option key={i.label} value={i.label}>{i.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <p className="text-[12px] text-[var(--foreground-subtle)] mt-1">
                {t("products.bulkEdit.subcategoryHint")}
              </p>
            </div>

            {/* Style keywords */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className={labelCls}>{t("products.field.styles")}</label>
                <FilterChips
                  label={t("products.bulkEdit.modeFor", { field: t("products.field.styles") })}
                  value={bulk.styleMode}
                  options={bulkModeOptions}
                  onChange={(v) => setBulk((b) => ({ ...b, styleMode: v as typeof b.styleMode }))}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_KEYWORDS.map((k) => {
                  const on = bulk.styleKeywords.includes(k);
                  return (
                    <button key={k} onClick={() => setBulk((b) => ({
                      ...b,
                      styleKeywords: on ? b.styleKeywords.filter((x) => x !== k) : [...b.styleKeywords, k],
                    }))}
                      className={`px-2.5 py-1 text-[11px] border rounded-full transition-colors ${on ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)]"}`}
                    >{styleLabel(k)}</button>
                  );
                })}
              </div>
            </div>

            {/* Color filters */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className={labelCls}>{t("products.field.colorGroups")}</label>
                <FilterChips
                  label={t("products.bulkEdit.modeFor", { field: t("products.field.colorGroups") })}
                  value={bulk.colorMode}
                  options={bulkModeOptions}
                  onChange={(v) => setBulk((b) => ({ ...b, colorMode: v as typeof b.colorMode }))}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {colorGroups.map((g) => {
                  const on = bulk.colorGroupIds.includes(g.id);
                  return (
                    <button key={g.id} onClick={() => setBulk((b) => ({
                      ...b,
                      colorGroupIds: on ? b.colorGroupIds.filter((x) => x !== g.id) : [...b.colorGroupIds, g.id],
                    }))}
                      className={`px-2.5 py-1 text-[11px] border rounded-full transition-colors ${on ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)]"}`}
                    >{g.name}</button>
                  );
                })}
              </div>
            </div>

            {/* Names */}
            <div>
              <label className={labelCls}>{t("products.field.names")}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={bulk.nameFind} onChange={(e) => setBulk((b) => ({ ...b, nameFind: e.target.value }))} placeholder={t("products.bulkEdit.find")} className={inputCls} />
                <input value={bulk.nameReplace} onChange={(e) => setBulk((b) => ({ ...b, nameReplace: e.target.value }))} placeholder={t("products.bulkEdit.replaceWith")} className={inputCls} />
                <input value={bulk.namePrefix} onChange={(e) => setBulk((b) => ({ ...b, namePrefix: e.target.value }))} placeholder={t("products.bulkEdit.addBefore")} className={inputCls} />
                <input value={bulk.nameSuffix} onChange={(e) => setBulk((b) => ({ ...b, nameSuffix: e.target.value }))} placeholder={t("products.bulkEdit.addAfter")} className={inputCls} />
              </div>
              <p className="text-[12px] text-[var(--foreground-subtle)] mt-1">
                {t("products.bulkEdit.namesHint")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-t border-[var(--border)]">
            <span className="text-[11px] text-[var(--foreground-muted)]">
              {bulkChangeCount ? t("products.bulkEdit.willChange", { count: bulkChangeCount }) : t("products.bulkEdit.nothing")}
            </span>
            <div className="flex items-center gap-3">
              <button onClick={() => { setBulkOpen(false); resetBulk(); }} className={btn("ghost")}>
                {t("common.cancel")}
              </button>
              <button
                onClick={applyBulkEdit}
                disabled={bulkSaving || !bulkChangeCount || !canWrite}
                className={btn("primary")}
              >
                {bulkSaving ? t("products.bulkEdit.applying") : t("products.bulkEdit.apply", { count: selectedIds.size })}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <DataTable
        label={t("nav.products")}
        rows={filtered}
        rowKey={(p) => p.id}
        loading={loading}
        resetKey={tableResetKey}
        selection={{
          selected: selectedIds,
          onToggle: toggleSelect,
          onToggleAll: toggleSelectAll,
          allSelected,
          rowLabel: (p) => p.name,
        }}
        columns={productColumns}
        onRowClick={(p) => router.push(productHref(p.id))}
        card={(p) => ({
          thumb: <Thumb src={p.imageUrl} bg={p.bgColor} size="lg" />,
          title: p.name,
          badge: p.isNew ? <Badge>{t("products.badge.new")}</Badge> : undefined,
          meta: `${p.brand} · ${f.moneyRange(p.priceMin, p.priceMax)}`,
        })}
        actions={(product) => (
          <>
            <Link
              href={productHref(product.id)}
              className={`${BTN_ICON_SM} max-md:hidden`}
              aria-label={t("products.row.edit", { name: product.name })}
              title={t("products.row.edit", { name: product.name })}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M11 2.5L13.5 5 6 12.5l-3 .5.5-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </Link>
            <RowMenu size="sm" label={t("menu.moreFor", { name: product.name })} items={rowItems(product)} />
          </>
        )}
        empty={
          loadError ? (
            <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <p className="text-[13px] text-[var(--err)] break-words">{loadError}</p>
              <button onClick={fetchProducts} className={btn("secondary")}>
                {t("products.retry")}
              </button>
            </div>
          ) : (
            <EmptyState
              text={t(products.length ? "products.empty.filtered" : "products.empty.none")}
              action={
                activeFilters.length > 0 || searchQuery ? (
                  <button
                    onClick={() => {
                      clearFilters();
                      setSearchQuery("");
                    }}
                    className={btn("secondary")}
                  >
                    {t("products.clearFilters")}
                  </button>
                ) : undefined
              }
            />
          )
        }
      />

      <BulkBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { key: "edit", label: t("products.bulk.edit"), onClick: () => setBulkOpen(true), disabled: !canWrite },
          ...(selectedIds.size >= 2
            ? [{ key: "group", label: t("products.bulk.group"), onClick: openGroupModal, disabled: !canWrite }]
            : []),
          { key: "cards", label: t("products.bulk.download"), onClick: () => void cards.download(exportIds), disabled: cards.busy },
          { key: "delete", label: t(deleting ? "products.bulk.deleting" : "products.bulk.delete"), onClick: handleBulkDelete, disabled: deleting || !canWrite, tone: "danger" as const },
        ]}
      />


      {/* ── Crop Editor Modal ── */}
      {cropProduct && (
        <Modal
          onClose={() => setCropProduct(null)}
          label={t("crop.title")}
          panelClassName="rounded-2xl p-5 md:p-8 max-w-xl w-full max-h-[90dvh] md:max-h-[95vh] overflow-y-auto"
          closeOnScrim={false}
        >
          {/* Title, with the button that removes the crop */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-4">
            <h2 className="font-display text-xl font-light text-[var(--foreground)] min-w-0">{t("crop.title")}</h2>
            <div className="flex items-center gap-3 ml-auto">
              {cropProduct.cropData && canWrite && (
                <button
                  onClick={() => { handleCropClear(cropProduct); setCropProduct(null); }}
                  className={btn("danger")}
                >
                  {t("crop.remove")}
                </button>
              )}
              <button
                onClick={() => setCropProduct(null)}
                aria-label={t("common.close")}
                title={t("common.close")}
                className={BTN_ICON}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <ImageCropEditor
            imageUrl={cropProduct.imageUrl}
            productName={cropProduct.name}
            initialCrop={cropProduct.cropData}
            onSave={handleCropSave}
            onCancel={() => setCropProduct(null)}
            saving={cropSaving}
          />
        </Modal>
      )}

      {/* ── Group Variants Modal ── */}
      {groupModal.open && (
        <Modal
          onClose={() => setGroupModal({ open: false, entries: [] })}
          label={t("products.bulk.group")}
          panelClassName="rounded-2xl p-5 md:p-8 max-w-lg w-full max-h-[90dvh] md:max-h-[92vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {t(groupModal.existingGroupId ? "products.group.titleEdit" : "products.group.titleNew")}
              </h2>
              <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                {t("products.group.hint")}
              </p>
            </div>
            <button
              onClick={() => setGroupModal({ open: false, entries: [] })}
              aria-label={t("common.close")}
              title={t("common.close")}
              className={`${BTN_ICON} shrink-0`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {groupModal.entries.map((entry) => {
              const p = products.find((x) => x.id === entry.id);
              if (!p) return null;
              return (
                <div
                  key={entry.id}
                  className={`border rounded-xl p-3 flex items-center gap-3 transition-colors ${
                    entry.isPrimary ? "border-[var(--foreground)]" : "border-[var(--border)]"
                  }`}
                >
                  <Thumb src={p.imageUrl} bg={p.bgColor} />

                  {/* Name + swatch */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--foreground)] truncate">{p.name}</p>
                    <p className="text-[12px] text-[var(--foreground-muted)] truncate">{p.brand} · {f.money(p.priceMin)}</p>

                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="color"
                        value={entry.colorHex}
                        onChange={(e) =>
                          setGroupModal((prev) => ({
                            ...prev,
                            entries: prev.entries.map((en) =>
                              en.id === entry.id ? { ...en, colorHex: e.target.value } : en
                            ),
                          }))
                        }
                        className="w-7 h-7 border border-[var(--border)] cursor-pointer bg-transparent p-0.5 shrink-0"
                        title={t("products.group.swatch")}
                      />
                      <input
                        type="text"
                        value={entry.colorHex}
                        onChange={(e) =>
                          setGroupModal((prev) => ({
                            ...prev,
                            entries: prev.entries.map((en) =>
                              en.id === entry.id ? { ...en, colorHex: e.target.value } : en
                            ),
                          }))
                        }
                        maxLength={7}
                        placeholder="#888888"
                        className={`${inputCls} font-mono max-w-[100px] py-1`}
                      />
                    </div>
                  </div>

                  {/* Primary: a state on the one that is, an action on the
                      rest. Pressing the primary itself changed nothing, so it
                      is a badge rather than a button. */}
                  <div className="shrink-0 text-center">
                    {entry.isPrimary ? (
                      <Badge tone="inverse">{t("products.badge.primary")}</Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setGroupModal((prev) => ({
                            ...prev,
                            entries: prev.entries.map((en) => ({
                              ...en,
                              isPrimary: en.id === entry.id,
                            })),
                          }))
                        }
                        className={btn("secondary", "sm")}
                      >
                        {t("products.group.setPrimary")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[12px] text-[var(--foreground-subtle)] mt-4">
            {rich(t("products.group.help"))}
          </p>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleGroupSave}
              disabled={grouping || !canWrite}
              className={`${btn("primary")} flex-1`}
            >
              {t(grouping ? "common.saving" : groupModal.existingGroupId ? "products.group.update" : "products.group.create")}
            </button>
            <button
              onClick={() => setGroupModal({ open: false, entries: [] })}
              className={btn("ghost")}
            >
              {t("common.cancel")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
