"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "@/components/ui/Image";
import type { Outfit, Product, Occasion, StyleKeyword, Category } from "@/lib/types";
import { STYLE_KEYWORD_LIST as STYLE_KEYWORDS, normalizeStyleKeywords, styleLabel } from "@/lib/style-keywords";
import { useDownloadCards } from "@/components/admin/DownloadCardsButton";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { btn, BTN_ICON, BTN_ICON_SM } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT } from "@/app/goo-studio/_i18n";
import type { Key } from "@/app/goo-studio/_i18n";
import { DataTable, EmptyState, Thumb } from "@/components/admin/DataTable";
import type { Column } from "@/components/admin/DataTable";
import { ActiveFilters, FilterMenu, SearchField } from "@/components/admin/FilterBar";
import { BulkBar } from "@/components/admin/BulkBar";
import { RowMenu } from "@/components/admin/Menu";
import type { MenuItem } from "@/components/admin/Menu";
import { Tabs, tabPanel } from "@/components/admin/Tabs";
import { Modal } from "@/components/admin/Modal";

interface PendingLook {
  id: string;
  created_at: string;
  generated_image: string;
  generated_style: string | null;
  pieces: { slot: string; productId: string; imageUrl?: string; name?: string }[];
  total_price: number | null;
  style_keywords: string[];
  status: string;
  /**
   * What the shopper called it. Nullable because migration 017 added these
   * columns after the first submissions existed — an older row simply has
   * nothing to show, and approval falls back to its own defaults.
   */
  name: string | null;
  description: string | null;
  occasion: string | null;
  season: string | null;
}

type OutfitRole = "hero" | "secondary" | "accent";
type Season = "all" | "spring" | "summer" | "autumn" | "winter";

interface SelectedItem {
  product: Product;
  role: OutfitRole;
  selectedColor?: string;
}

interface OutfitFormState {
  name: string;
  occasion: Occasion;
  season: Season;
  description: string;
  imageUrl: string;
  styleKeywords: StyleKeyword[];
  isAIGenerated: boolean;
}

const OCCASIONS: Occasion[] = ["casual", "work", "evening", "sport", "formal", "weekend"];
const SEASONS: Season[] = ["all", "spring", "summer", "autumn", "winter"];
const CATEGORIES: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "outerwear", label: "Outerwear" },
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "dresses", label: "Dresses" },
  { value: "knitwear", label: "Knitwear" },
  { value: "footwear", label: "Footwear" },
  { value: "accessories", label: "Accessories" },
];
const ROLES: OutfitRole[] = ["hero", "secondary", "accent"];

const OCCASION_KEY: Record<Occasion, Key> = {
  casual: "outfits.occasion.casual",
  work: "outfits.occasion.work",
  evening: "outfits.occasion.evening",
  sport: "outfits.occasion.sport",
  formal: "outfits.occasion.formal",
  weekend: "outfits.occasion.weekend",
};
const SEASON_KEY: Record<Season, Key> = {
  all: "outfits.season.all",
  spring: "outfits.season.spring",
  summer: "outfits.season.summer",
  autumn: "outfits.season.autumn",
  winter: "outfits.season.winter",
};

type SortKey = "newest" | "oldest" | "name" | "priceAsc" | "priceDesc";
const SORT_OPTIONS: { value: SortKey; label: Key }[] = [
  { value: "newest", label: "outfits.sort.newest" },
  { value: "oldest", label: "outfits.sort.oldest" },
  { value: "name", label: "outfits.sort.nameAsc" },
  { value: "priceAsc", label: "outfits.sort.priceAsc" },
  { value: "priceDesc", label: "outfits.sort.priceDesc" },
];


/** Most pieces an outfit takes — as many as the collage on the site can draw. */
const MAX_ITEMS = 6;
/**
 * Most products the picker draws at once. The catalogue runs to thousands of
 * rows with an image each; past this the search is the way to narrow it.
 */
const PICKER_LIMIT = 60;

const defaultForm: OutfitFormState = {
  name: "",
  occasion: "casual",
  season: "all",
  description: "",
  imageUrl: "",
  styleKeywords: [],
  isAIGenerated: false,
};

const inputCls =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";
const selectCls =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-[var(--surface)] text-[var(--foreground)] transition-colors";
const labelCls = "block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5";

export default function AdminOutfitsPage() {
  const t = useT();
  const f = useFormat();
  const confirm = useConfirm();
  const toast = useToast();
  const cards = useDownloadCards("outfits");
  const [adminTab, setAdminTab] = useState<"outfits" | "pending">("outfits");

  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  /** Why the list did not load — shown in place of the table's rows. */
  const [outfitsError, setOutfitsError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OutfitFormState>(defaultForm);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState<Category | "all">("all");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [occasionFilter, setOccasionFilter] = useState<Occasion | "">("");
  const [seasonFilter, setSeasonFilter] = useState<Season | "">("");
  const [homeFilter, setHomeFilter] = useState<"on" | "off" | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  /** Ticked rows, by outfit id — what the selection bar acts on. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [featuringId, setFeaturingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [pendingLooks, setPendingLooks] = useState<PendingLook[]>([]);
  // True from the start: the queue loads with the page, not with its tab.
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingError, setPendingError] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedLook, setSelectedLook] = useState<PendingLook | null>(null);
  /** Why the last Approve or Reject failed, shown inside the review modal. */
  const [moderationError, setModerationError] = useState("");

  /**
   * The moderator's version of the submission.
   *
   * Editing here rather than after approval is the point: an admin who has to
   * approve something wrong and then find it again in the outfits table will
   * eventually stop bothering, and the catalogue fills with whatever arrived.
   * The approval endpoint takes these as `overrides` and falls back to the
   * submitted values field by field, so clearing one restores the shopper's.
   */
  const [moderation, setModeration] = useState({
    name: "",
    description: "",
    occasion: "casual" as Occasion,
    season: "all" as Season,
    styleKeywords: [] as StyleKeyword[],
  });

  const openSubmission = (look: PendingLook) => {
    setModeration({
      name: look.name ?? "",
      description: look.description ?? "",
      occasion: (OCCASIONS as string[]).includes(look.occasion ?? "")
        ? (look.occasion as Occasion)
        : "casual",
      season: (SEASONS as string[]).includes(look.season ?? "")
        ? (look.season as Season)
        : "all",
      styleKeywords: normalizeStyleKeywords(look.style_keywords),
    });
    setModerationError("");
    setSelectedLook(look);
  };

  const toggleModerationStyle = (kw: StyleKeyword) => {
    setModeration((m) => ({
      ...m,
      styleKeywords: m.styleKeywords.includes(kw)
        ? m.styleKeywords.filter((k) => k !== kw)
        : [...m.styleKeywords, kw],
    }));
  };

  /**
   * The outfits table, straight from the database. A failed read says so
   * rather than falling back to the demo looks, which the table would show as
   * real ones that can be neither edited nor deleted.
   */
  const loadOutfits = useCallback(async () => {
    try {
      const res = await fetch("/api/outfits");
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setOutfitsError(data?.error ?? `Outfits did not load (${res.status}).`);
        return;
      }
      setOutfits(data);
      setOutfitsError("");
    } catch {
      setOutfitsError("Outfits did not load (network error).");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * The moderation queue. Read once with the page, so the Pending tab can show
   * its count before anyone opens it, and again each time the tab is opened.
   */
  const loadPending = useCallback(async () => {
    try {
      const res = await fetch("/api/looks/pending");
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setPendingError(data?.error ?? `The queue did not load (${res.status}).`);
        return;
      }
      setPendingLooks(
        (data as PendingLook[]).map((l) => ({ ...l, style_keywords: normalizeStyleKeywords(l.style_keywords) })),
      );
      setPendingError("");
    } catch {
      setPendingError("The queue did not load (network error).");
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    loadOutfits();
    loadPending();
  }, [loadOutfits, loadPending]);

  const handleApproveLook = async (id: string) => {
    setApprovingId(id);
    setModerationError("");
    try {
      const res = await fetch("/api/looks/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          // Field by field, so a cleared box means "keep what was submitted"
          // rather than "publish an empty string".
          overrides: {
            name: moderation.name.trim(),
            description: moderation.description.trim(),
            occasion: moderation.occasion,
            season: moderation.season,
            styleKeywords: normalizeStyleKeywords(moderation.styleKeywords),
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setModerationError(err.error ?? `Approval failed (${res.status}).`);
        // 404/409: someone else already approved or rejected it — bring the
        // queue and the table up to date behind the modal.
        if (res.status === 404 || res.status === 409) {
          loadPending();
          loadOutfits();
        }
        return;
      }
      setPendingLooks((prev) => prev.filter((l) => l.id !== id));
      setSelectedLook(null);
      // The new outfit is built on the server, so read the list again rather
      // than make one up here.
      loadOutfits();
    } catch {
      setModerationError("Approval failed (network error).");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectLook = async (id: string) => {
    if (!(await confirm({
      title: "Reject this look?",
      body: "It leaves the queue and will not be published.",
      confirmLabel: "Reject look",
      tone: "danger",
    }))) return;
    setApprovingId(id);
    setModerationError("");
    try {
      const res = await fetch("/api/looks/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setModerationError(err.error ?? `Rejection failed (${res.status}).`);
        return;
      }
      setPendingLooks((prev) => prev.filter((l) => l.id !== id));
      setSelectedLook(null);
    } catch {
      setModerationError("Rejection failed (network error).");
    } finally {
      setApprovingId(null);
    }
  };

  // Load products when modal opens
  const loadProducts = useCallback(() => {
    if (products.length > 0) return;
    setLoadingProducts(true);
    fetch("/api/products?raw=true")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [products.length]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(defaultForm);
    setSelectedItems([]);
    setSaveError("");
    setUploadError("");
    setProductSearch("");
    setProductCategory("all");
    setShowModal(true);
    loadProducts();
  };

  const openEditModal = (outfit: Outfit) => {
    setEditingId(outfit.id);
    setForm({
      name: outfit.name,
      occasion: outfit.occasion,
      season: outfit.season,
      description: outfit.description,
      imageUrl: outfit.imageUrl,
      styleKeywords: outfit.styleKeywords,
      isAIGenerated: outfit.isAIGenerated,
    });
    setSelectedItems(outfit.items.map((i) => ({ product: i.product, role: i.role, selectedColor: i.selectedColor })));
    setSaveError("");
    setUploadError("");
    setProductSearch("");
    setProductCategory("all");
    setShowModal(true);
    loadProducts();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "Upload failed");
      } else {
        setForm((f) => ({ ...f, imageUrl: json.url }));
      }
    } catch {
      setUploadError("Network error during upload");
    } finally {
      setUploading(false);
    }
  };

  // Price auto-calculated from selected items
  const priceMin = selectedItems.reduce((s, i) => s + i.product.priceMin, 0);
  const priceMax = selectedItems.reduce((s, i) => s + i.product.priceMax, 0);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError("");

    const body = {
      ...form,
      items: selectedItems.map((i) => ({ productId: i.product.id, role: i.role, selectedColor: i.selectedColor })),
      totalPriceMin: priceMin,
      totalPriceMax: priceMax,
      currency: "USD",
    };

    try {
      const url = editingId ? `/api/outfits/${editingId}` : "/api/outfits";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Any failure keeps the editor open with the reason: the outfit is only
      // in the table once the database has it.
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error ?? `Failed to save (${res.status}).`);
        return;
      }

      const saved: Outfit = await res.json();
      if (editingId) {
        setOutfits((prev) => prev.map((o) => (o.id === editingId ? saved : o)));
      } else {
        setOutfits((prev) => [saved, ...prev]);
      }
      closeModal();
    } catch {
      setSaveError("Network error — the outfit was not saved.");
    } finally {
      setSaving(false);
    }
  };

  // ── Rows in the table, and the ones ticked ─────────────────────────────────

  const filteredOutfits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = outfits.filter((o) => {
      if (occasionFilter && o.occasion !== occasionFilter) return false;
      if (seasonFilter && o.season !== seasonFilter) return false;
      if (homeFilter && !!o.isHomepageFeatured !== (homeFilter === "on")) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.occasion.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.styleKeywords.some((k) => styleLabel(k).toLowerCase().includes(q)) ||
        o.items.some((i) => i.product.name.toLowerCase().includes(q) || i.product.brand.toLowerCase().includes(q))
      );
    });
    // "Newest" keeps the order the API sends (newest first) for looks with no date.
    const time = (o: Outfit) => (o.createdAt ? Date.parse(o.createdAt) : 0);
    const sorted = [...list];
    if (sortKey === "newest") sorted.sort((a, b) => time(b) - time(a));
    else if (sortKey === "oldest") sorted.sort((a, b) => time(a) - time(b));
    else if (sortKey === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === "priceAsc") sorted.sort((a, b) => a.totalPriceMin - b.totalPriceMin);
    else sorted.sort((a, b) => b.totalPriceMin - a.totalPriceMin);
    return sorted;
  }, [outfits, searchQuery, occasionFilter, seasonFilter, homeFilter, sortKey]);

  const allSelected = filteredOutfits.length > 0 && filteredOutfits.every((o) => selectedIds.has(o.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  /**
   * Tick a row, and with Shift held, everything between it and the row ticked
   * before it — the same gesture the products table has.
   *
   * The anchor is the last row whose checkbox was used, held in a ref because it
   * steers the next click rather than anything on screen. The range takes the
   * state the clicked row is moving *to*, so shift-clicking clears a run as
   * readily as it selects one.
   */
  const rangeAnchor = useRef<string | null>(null);

  const toggleSelect = (id: string, extendRange = false) => {
    // Read the anchor here rather than inside the updater: React runs the
    // updater at render time, by which point the assignment below has already
    // moved the anchor to this row, and the range would be the row against
    // itself.
    const anchor = rangeAnchor.current;
    rangeAnchor.current = id;

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (extendRange && anchor && anchor !== id) {
        const ids = filteredOutfits.map((o) => o.id);
        const from = ids.indexOf(anchor);
        const to = ids.indexOf(id);
        // A search that has moved on can leave the anchor off the current list.
        // Falling through to the plain toggle is the honest answer then.
        if (from !== -1 && to !== -1) {
          const selecting = !prev.has(id);
          for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
            if (selecting) next.add(ids[i]);
            else next.delete(ids[i]);
          }
          return next;
        }
      }

      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    rangeAnchor.current = null;
    setSelectedIds(allSelected ? new Set() : new Set(filteredOutfits.map((o) => o.id)));
  };

  /** Forget rows that are no longer there, so a deleted look cannot be exported. */
  const deselect = (ids: string[]) => {
    setSelectedIds((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  /**
   * What "Download cards" will draw: the selection when there is one, and
   * otherwise whatever the search has narrowed the table to.
   *
   * A list that is every look goes as `null` instead, so exporting the lot stays
   * a short request rather than a POST carrying every id the server is about to
   * read out of its own table anyway.
   */
  const exportIds = useMemo(() => {
    if (selectedIds.size) return filteredOutfits.filter((o) => selectedIds.has(o.id)).map((o) => o.id);
    if (filteredOutfits.length === outfits.length) return null;
    return filteredOutfits.map((o) => o.id);
  }, [filteredOutfits, outfits.length, selectedIds]);

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!(await confirm({
      title: t("outfits.confirm.bulkDelete", { count: ids.length }),
      confirmLabel: t("outfits.confirm.bulkDeleteAction", { count: ids.length }),
      tone: "danger",
    }))) return;

    setBulkDeleting(true);
    const deleted: string[] = [];
    const failed: string[] = [];
    // One at a time: the delete endpoint takes a single id, and firing thirty at
    // once at it buys nothing an admin would notice.
    for (const id of ids) {
      try {
        const res = await fetch(`/api/outfits/${id}`, { method: "DELETE" });
        if (res.ok) deleted.push(id);
        else failed.push(id);
      } catch {
        failed.push(id);
      }
    }
    setOutfits((prev) => prev.filter((o) => !deleted.includes(o.id)));
    deselect(deleted);
    if (failed.length) toast.err(t("outfits.bulk.partial", { failed: failed.length, total: ids.length }));
    setBulkDeleting(false);
  };

  const handleToggleFeatured = async (outfit: Outfit) => {
    setFeaturingId(outfit.id);
    const next = !outfit.isHomepageFeatured;
    try {
      const res = await fetch(`/api/outfits/${outfit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHomepageFeatured: next }),
      });
      if (res.ok) {
        setOutfits((prev) =>
          prev.map((o) => (o.id === outfit.id ? { ...o, isHomepageFeatured: next } : o))
        );
      } else {
        const err = await res.json().catch(() => ({}));
        toast.err(err.error ?? `Could not update the homepage flag (${res.status}).`);
      }
    } catch {
      toast.err("Could not update the homepage flag (network error).");
    } finally {
      setFeaturingId(null);
    }
  };

  const handleDelete = async (outfit: Outfit) => {
    if (!(await confirm({
      title: t("outfits.confirm.delete", { name: outfit.name }),
      body: t("outfits.confirm.deleteBody"),
      confirmLabel: t("outfits.confirm.deleteAction"),
      tone: "danger",
    }))) return;
    const id = outfit.id;
    // The row goes only once the server says the outfit is gone.
    try {
      const res = await fetch(`/api/outfits/${id}`, { method: "DELETE" });
      if (res.ok) {
        setOutfits((prev) => prev.filter((o) => o.id !== id));
        deselect([id]);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.err(err.error ?? `Failed to delete outfit (${res.status}).`);
      }
    } catch {
      toast.err("Failed to delete outfit (network error).");
    }
  };

  const toggleItem = (product: Product) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.product.id === product.id);
      if (exists) return prev.filter((i) => i.product.id !== product.id);
      if (prev.length >= MAX_ITEMS) return prev;
      const role: OutfitRole =
        prev.length === 0 ? "hero" : prev.length === 1 ? "secondary" : "accent";
      return [...prev, { product, role }];
    });
  };

  const setRole = (productId: string, role: OutfitRole) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, role } : i))
    );
  };

  const setSelectedColor = (productId: string, color: string) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, selectedColor: color } : i))
    );
  };

  const removeItem = (productId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const toggleKeyword = (kw: StyleKeyword) => {
    setForm((f) => ({
      ...f,
      styleKeywords: f.styleKeywords.includes(kw)
        ? f.styleKeywords.filter((k) => k !== kw)
        : [...f.styleKeywords, kw],
    }));
  };

  // Filtered products for the picker. Memoised so typing in the outfit's own
  // fields does not re-filter the whole catalogue on every key.
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q);
      const matchesCategory = productCategory === "all" || p.category === productCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, productSearch, productCategory]);
  const shownProducts = useMemo(() => filteredProducts.slice(0, PICKER_LIMIT), [filteredProducts]);
  const atItemLimit = selectedItems.length >= MAX_ITEMS;

  // ── The table ─────────────────────────────────────────────────────────────

  const featuredCount = outfits.filter((o) => o.isHomepageFeatured).length;
  const aiCount = outfits.filter((o) => o.isAIGenerated).length;

  const clearFilters = () => {
    setSearchQuery("");
    setOccasionFilter("");
    setSeasonFilter("");
    setHomeFilter("");
  };

  const activeFilters = [
    ...(occasionFilter
      ? [{ key: "occasion", label: `${t("outfits.f.occasion")}: ${t(OCCASION_KEY[occasionFilter])}`, onRemove: () => setOccasionFilter("") }]
      : []),
    ...(seasonFilter
      ? [{ key: "season", label: `${t("outfits.f.season")}: ${t(SEASON_KEY[seasonFilter])}`, onRemove: () => setSeasonFilter("") }]
      : []),
    ...(homeFilter
      ? [
          {
            key: "home",
            label: `${t("outfits.f.homepage")}: ${t(homeFilter === "on" ? "outfits.home.filterOn" : "outfits.home.filterOff")}`,
            onRemove: () => setHomeFilter(""),
          },
        ]
      : []),
  ];

  /** Back to the first page when what the table shows changes. */
  const tableResetKey = [searchQuery, occasionFilter, seasonFilter, homeFilter, sortKey].join("|");

  const rowItems = (o: Outfit): MenuItem[] => [
    // Also an icon beside the menu; on a phone the icon gives its room to the name.
    { label: t("outfits.row.editShort"), onSelect: () => openEditModal(o) },
    { label: t("cards.downloadOne"), onSelect: () => void cards.download([o.id]), disabled: cards.busy },
    {
      // The switch's column starts at md; below it, this is the way.
      label: t(o.isHomepageFeatured ? "outfits.row.unfeature" : "outfits.row.feature"),
      onSelect: () => void handleToggleFeatured(o),
      disabled: featuringId === o.id,
    },
    { kind: "separator" },
    { label: t("outfits.row.delete"), onSelect: () => void handleDelete(o), tone: "danger" },
  ];

  const outfitColumns: Column<Outfit>[] = [
    {
      key: "outfit",
      header: t("outfits.col.outfit"),
      grow: true,
      cell: (o) => (
        <div className="flex items-center gap-3 min-w-0">
          <Thumb src={o.imageUrl} fit="cover" />
          <div className="min-w-0">
            <div className="font-medium truncate" title={o.name}>
              {o.name}
            </div>
            {o.styleKeywords.length > 0 && (
              <div className="text-[12px] text-[var(--foreground-muted)] truncate">{o.styleKeywords.map(styleLabel).join(" · ")}</div>
            )}
          </div>
        </div>
      ),
    },
    { key: "occasion", header: t("outfits.col.occasion"), hide: "md", cell: (o) => t(OCCASION_KEY[o.occasion] ?? "outfits.occasion.casual") },
    { key: "season", header: t("outfits.col.season"), hide: "lg", cell: (o) => t(SEASON_KEY[o.season] ?? "outfits.season.all") },
    {
      key: "items",
      header: t("outfits.col.items"),
      align: "right",
      hide: "lg",
      cell: (o) => <span className="text-[var(--foreground-muted)]">{o.items.length}</span>,
    },
    { key: "price", header: t("outfits.col.price"), align: "right", hide: "md", cell: (o) => f.moneyRange(o.totalPriceMin, o.totalPriceMax) },
    {
      key: "home",
      header: t("outfits.col.homepage"),
      hide: "md",
      cell: (o) => {
        const on = !!o.isHomepageFeatured;
        return (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t("outfits.home.switch", { name: o.name })}
            onClick={() => void handleToggleFeatured(o)}
            disabled={featuringId === o.id}
            className="group/sw inline-flex items-center gap-2 h-7 disabled:opacity-40"
          >
            <span
              aria-hidden="true"
              className={`relative w-7 h-4 rounded-full transition-colors ${on ? "bg-[var(--foreground)]" : "bg-[var(--border-strong)]"}`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-[var(--surface)] transition-[left] ${on ? "left-3.5" : "left-0.5"}`}
              />
            </span>
            <span className={on ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)] group-hover/sw:text-[var(--foreground)]"}>
              {t(on ? "outfits.home.on" : "outfits.home.off")}
            </span>
          </button>
        );
      },
    },
  ];

  return (
    <div>
      {/* Header: what the open tab holds, and its actions. */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">{t("nav.outfits")}</h1>
          <p className="text-[13px] text-[var(--foreground-muted)] mt-1">
            {adminTab === "pending"
              ? loadingPending
                ? t("common.loading")
                : t("outfits.summary.pending", { count: pendingLooks.length })
              : loading
                ? t("common.loading")
                : outfitsError
                  ? "—"
                  : [
                      t("outfits.summary.count", { count: outfits.length }),
                      t("outfits.summary.home", { count: featuredCount }),
                      t("outfits.summary.ai", { count: aiCount }),
                    ].join(" · ")}
          </p>
        </div>
        {adminTab === "outfits" && (
          <div className="flex items-center gap-2 flex-wrap">
            {cards.busy && (
              <span role="status" className="text-[12px] text-[var(--foreground-muted)] tabular-nums">
                {cards.received ? t("cards.packingMb", { mb: (cards.received / (1024 * 1024)).toFixed(1) }) : t("cards.packing")}
              </span>
            )}
            {/* The looks in the table — the ticked ones, or all of them — drawn as
                pictures with the cards of their pieces, as one ZIP. */}
            <button
              onClick={() => void cards.download(exportIds)}
              disabled={cards.busy || outfits.length === 0}
              className={btn("secondary")}
            >
              {t("cards.download")}
            </button>
            <button onClick={openAddModal} className={btn("primary")}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {t("outfits.add")}
            </button>
          </div>
        )}
      </div>

      {/* The count shows on Pending even at zero: an empty queue is news too. */}
      <div className="mb-6">
        <Tabs
          label={t("outfits.tabs")}
          idBase="outfits"
          tabs={[
            { key: "outfits", label: t("outfits.tab.outfits"), count: outfitsError ? undefined : outfits.length },
            { key: "pending", label: t("outfits.tab.pending"), count: pendingError ? undefined : pendingLooks.length },
          ]}
          value={adminTab}
          onChange={(key) => {
            setAdminTab(key);
            if (key === "pending") loadPending();
          }}
        />
      </div>

      {/* ── Pending looks tab ── */}
      {adminTab === "pending" && (
        <div {...tabPanel("outfits", "pending")}>
          {pendingError && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-2.5 text-xs text-[var(--err)]">
              <span>{pendingError}</span>
              <button
                onClick={() => {
                  setLoadingPending(true);
                  loadPending();
                }}
                className="ml-4 underline underline-offset-4 opacity-80 hover:opacity-100 transition-opacity"
              >
                Retry
              </button>
            </div>
          )}
          {loadingPending ? (
            <p className="text-xs text-[var(--foreground-subtle)] py-8 text-center">Loading…</p>
          ) : pendingError && pendingLooks.length === 0 ? null : pendingLooks.length === 0 ? (
            <p className="text-xs text-[var(--foreground-subtle)] py-8 text-center">No looks awaiting review.</p>
          ) : (
            <div className="rounded-xl border border-[var(--border)]" style={{ background: "var(--surface)" }}>
              {pendingLooks.map((look, idx) => (
                <div
                  key={look.id}
                  onClick={() => openSubmission(look)}
                  className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-[var(--background)] transition-colors ${
                    idx !== 0 ? "border-t border-[var(--border)]" : ""
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-16 shrink-0 overflow-hidden bg-[var(--background)] rounded-xl border border-[var(--border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={look.generated_image} alt="Look" className="w-full h-full object-cover" />
                  </div>
                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {look.generated_style && (
                        <span className="font-mono text-[11px] font-medium border border-[var(--border)] text-[var(--foreground-subtle)] px-2 py-0.5 rounded-full">
                          {look.generated_style === "flatlay" ? "Flat lay" : look.generated_style === "tryon" ? "On you" : "AI"}
                        </span>
                      )}
                      {look.total_price != null && (
                        <span className="text-xs text-[var(--foreground)] font-medium">{f.money(look.total_price)}</span>
                      )}
                    </div>
                    {look.style_keywords.length > 0 && (
                      <p className="text-[12px] font-mono capitalize text-[var(--foreground-muted)] truncate">
                        {look.style_keywords.slice(0, 4).join(" · ")}
                      </p>
                    )}
                    <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">
                      {f.date(look.created_at)}
                      {" · "}{look.pieces.length} pieces
                    </p>
                  </div>
                  {/* Arrow */}
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[var(--foreground-subtle)]">
                    <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pending look detail modal ── */}
      {selectedLook && (
        <Modal
          onClose={() => setSelectedLook(null)}
          label="Review submitted look"
          panelClassName="w-full max-w-3xl max-h-[90dvh] flex flex-col rounded-2xl overflow-y-auto md:overflow-hidden"
        >
          {/* Modal header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              {selectedLook.generated_style && (
                <span className="font-mono text-[11px] font-medium border border-[var(--border)] text-[var(--foreground-subtle)] px-2 py-0.5 rounded-full">
                  {selectedLook.generated_style === "flatlay" ? "Flat lay" : selectedLook.generated_style === "tryon" ? "On you" : "AI"}
                </span>
              )}
              {selectedLook.total_price != null && (
                <p className="text-sm font-medium text-[var(--foreground)]">{f.money(selectedLook.total_price)}</p>
              )}
              {selectedLook.style_keywords.length > 0 && (
                <p className="font-mono text-[12px] capitalize text-[var(--foreground-muted)]">
                  {selectedLook.style_keywords.slice(0, 3).join(" · ")}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedLook(null)}
              aria-label="Close"
              className={BTN_ICON}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Body: image left, pieces right; stacked on phones, where the
              whole dialog scrolls instead of each column. */}
          <div className="flex flex-col md:flex-row shrink-0 md:shrink md:min-h-0 md:flex-1 md:overflow-hidden">
            {/* Generated image */}
            <div className="w-full h-72 md:h-auto md:w-[55%] shrink-0 bg-[var(--background)] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedLook.generated_image}
                alt="Generated look"
                className="w-full h-full object-cover object-top"
              />
            </div>

            {/* Pieces list */}
            <div className="flex-1 flex flex-col border-t md:border-t-0 md:border-l border-[var(--border)] md:overflow-y-auto divide-y divide-[var(--border)]">
              {selectedLook.pieces.length > 0 ? selectedLook.pieces.map((piece) => (
                <div key={piece.slot} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-12 h-12 shrink-0 bg-[var(--background)] rounded-xl border border-[var(--border)] overflow-hidden">
                    {piece.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={piece.imageUrl} alt={piece.name ?? piece.slot} className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-mono text-[11px] text-[var(--border-strong)]">{piece.slot[0].toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[12px] text-[var(--foreground-muted)] mb-0.5 capitalize">{piece.slot}</p>
                    <p className="text-xs text-[var(--foreground)] truncate">{piece.name ?? "—"}</p>
                  </div>
                </div>
              )) : (
                <div className="flex items-center justify-center flex-1 py-12">
                  <p className="text-xs text-[var(--foreground-subtle)]">No pieces</p>
                </div>
              )}
            </div>
          </div>

          {/* What the catalogue will show.
              Prefilled from the submission, so approving unchanged publishes
              exactly what the shopper wrote; empty means the approval
              endpoint keeps its own fallback rather than publishing blanks. */}
          <div className="px-5 py-4 border-t border-[var(--border)] shrink-0 md:max-h-[38vh] md:overflow-y-auto">
            <p className="text-[13px] font-medium text-[var(--foreground)] mb-3">
              Publish as
            </p>

            <input
              type="text"
              value={moderation.name}
              onChange={(e) => setModeration((m) => ({ ...m, name: e.target.value }))}
              placeholder="Community Look"
              maxLength={120}
              className={`${inputCls} mb-3`}
            />

            <textarea
              value={moderation.description}
              onChange={(e) => setModeration((m) => ({ ...m, description: e.target.value }))}
              placeholder="Description shown on the outfit page"
              rows={3}
              maxLength={2000}
              className={`${inputCls} resize-none mb-3`}
            />

            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <select
                value={moderation.occasion}
                onChange={(e) => setModeration((m) => ({ ...m, occasion: e.target.value as Occasion }))}
                className={`${selectCls} flex-1 capitalize`}
              >
                {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select
                value={moderation.season}
                onChange={(e) => setModeration((m) => ({ ...m, season: e.target.value as Season }))}
                className={`${selectCls} flex-1 capitalize`}
              >
                {SEASONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {STYLE_KEYWORDS.map((kw) => {
                const on = moderation.styleKeywords.includes(kw);
                return (
                  <button
                    key={kw}
                    onClick={() => toggleModerationStyle(kw)}
                    aria-pressed={on}
                    className={`px-4 py-2 rounded-full border text-[12px] font-medium transition-colors duration-200 ${
                      on
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                        : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {styleLabel(kw)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-[var(--border)] shrink-0">
            {moderationError && (
              <p className="mb-3 rounded-lg border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-2.5 text-xs text-[var(--err)]">
                {moderationError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handleApproveLook(selectedLook.id)}
                disabled={approvingId === selectedLook.id}
                className={`${btn("primary")} flex-1`}
              >
                {approvingId === selectedLook.id ? "Approving…" : "Approve — add to Outfits"}
              </button>
              <button
                onClick={() => handleRejectLook(selectedLook.id)}
                disabled={approvingId === selectedLook.id}
                className={`${btn("danger")} flex-1`}
              >
                Reject
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Outfits tab ── */}
      {adminTab === "outfits" && (
        <div {...tabPanel("outfits", "outfits")}>
          {/* Search and filters (FilterBar), the active ones as chips with the
              count, and the sort. */}
          <div className="mb-4 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t("outfits.search.placeholder")}
                label={t("outfits.search.label")}
              />
              <FilterMenu
                label={t("outfits.f.occasion")}
                value={occasionFilter}
                options={OCCASIONS.map((o) => ({ value: o, label: t(OCCASION_KEY[o]) }))}
                onChange={(v) => setOccasionFilter(v as Occasion | "")}
                allLabel={t("filter.all")}
              />
              <FilterMenu
                label={t("outfits.f.season")}
                value={seasonFilter}
                options={SEASONS.map((o) => ({ value: o, label: t(SEASON_KEY[o]) }))}
                onChange={(v) => setSeasonFilter(v as Season | "")}
                allLabel={t("filter.all")}
              />
              <FilterMenu
                label={t("outfits.f.homepage")}
                value={homeFilter}
                options={[
                  { value: "on", label: t("outfits.home.filterOn") },
                  { value: "off", label: t("outfits.home.filterOff") },
                ]}
                onChange={(v) => setHomeFilter(v as "on" | "off" | "")}
                allLabel={t("filter.any")}
              />
            </div>
            <ActiveFilters
              filters={activeFilters}
              onClearAll={clearFilters}
              count={loading || outfitsError ? null : t("filter.count", { shown: filteredOutfits.length, total: outfits.length })}
              trailing={
                <FilterMenu
                  label={t("filter.sort")}
                  value={sortKey}
                  options={SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
                  onChange={(v) => setSortKey(v as SortKey)}
                  variant="ghost"
                  align="end"
                />
              }
            />
          </div>

          <DataTable
            label={t("nav.outfits")}
            rows={filteredOutfits}
            rowKey={(o) => o.id}
            columns={outfitColumns}
            loading={loading}
            resetKey={tableResetKey}
            selection={{
              selected: selectedIds,
              onToggle: toggleSelect,
              onToggleAll: toggleSelectAll,
              allSelected,
              someSelected,
              rowLabel: (o) => o.name,
            }}
            actions={(o) => (
              <>
                <button
                  onClick={() => openEditModal(o)}
                  className={`${BTN_ICON_SM} max-md:hidden`}
                  aria-label={t("outfits.row.edit", { name: o.name })}
                  title={t("outfits.row.edit", { name: o.name })}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M11 2.5L13.5 5 6 12.5l-3 .5.5-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                </button>
                <RowMenu size="sm" label={t("menu.moreFor", { name: o.name })} items={rowItems(o)} />
              </>
            )}
            empty={
              outfitsError ? (
                <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                  <p className="text-[13px] text-[var(--err)] break-words">{outfitsError}</p>
                  <button
                    onClick={() => {
                      setLoading(true);
                      loadOutfits();
                    }}
                    className={btn("secondary")}
                  >
                    {t("common.retry")}
                  </button>
                </div>
              ) : (
                <EmptyState
                  text={t(outfits.length ? "outfits.empty.filtered" : "outfits.empty.none")}
                  action={
                    outfits.length ? (
                      <button onClick={clearFilters} className={btn("secondary")}>
                        {t("filter.clearFilters")}
                      </button>
                    ) : (
                      <button onClick={openAddModal} className={btn("primary")}>
                        {t("outfits.add")}
                      </button>
                    )
                  }
                />
              )
            }
          />

          <BulkBar
            count={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            actions={[
              { key: "cards", label: t("cards.download"), onClick: () => void cards.download(exportIds), disabled: cards.busy },
              {
                key: "delete",
                label: t(bulkDeleting ? "outfits.bulk.deleting" : "outfits.bulk.delete"),
                onClick: () => void handleBulkDelete(),
                disabled: bulkDeleting,
                tone: "danger",
              },
            ]}
          />
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <Modal
          onClose={closeModal}
          label={editingId ? "Edit outfit" : "New outfit"}
          panelClassName="rounded-2xl w-full max-w-5xl max-h-[90dvh] overflow-y-auto overscroll-contain lg:max-h-none lg:overflow-visible flex flex-col"
          scrimClassName="flex items-center lg:items-start justify-center overflow-y-auto p-4 lg:py-6"
          closeOnScrim={false}
        >
          {/* Below lg the dialog scrolls inside itself; from lg the overlay
              scrolls and each column keeps its own scroll. */}
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
            <h2 className="font-display text-xl font-light text-[var(--foreground)]">
              {editingId ? "Edit Outfit" : "New Outfit"}
            </h2>
            <button
              onClick={closeModal}
              aria-label="Close"
              className={BTN_ICON}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Modal body: two columns */}
          <div className="flex flex-col lg:flex-row lg:min-h-0">

            {/* ── LEFT: Product picker ── */}
            <div className="lg:w-[55%] border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <p className="text-[13px] font-medium text-[var(--foreground)] mb-3">
                  Products — select items for this outfit
                </p>
                {/* Search */}
                <input
                  type="search"
                  placeholder="Search by name or brand..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className={inputCls}
                />
                {/* Category filter */}
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {CATEGORIES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setProductCategory(value)}
                      aria-pressed={productCategory === value}
                      className={`px-4 py-2 rounded-full border text-[12px] font-medium transition-colors duration-200 ${
                        productCategory === value
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product grid */}
              <div className="overflow-y-auto flex-1 p-4 max-h-[45dvh] lg:max-h-[420px]">
                {loadingProducts ? (
                  <p className="text-xs text-[var(--foreground-subtle)] text-center py-8">Loading products...</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-xs text-[var(--foreground-subtle)] text-center py-8">No products found.</p>
                ) : (
                  <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {shownProducts.map((product) => {
                      const isSelected = selectedItems.some((i) => i.product.id === product.id);
                      const blocked = !isSelected && atItemLimit;
                      return (
                        <button
                          key={product.id}
                          onClick={() => toggleItem(product)}
                          disabled={blocked}
                          title={blocked ? `An outfit takes up to ${MAX_ITEMS} items` : undefined}
                          className={`text-left rounded-xl overflow-hidden border transition-colors group relative disabled:opacity-40 disabled:cursor-not-allowed ${
                            isSelected
                              ? "border-[var(--foreground)] bg-[var(--background)]"
                              : "border-[var(--border)] hover:border-[var(--foreground)] disabled:hover:border-[var(--border)]"
                          }`}
                        >
                          {/* Product image */}
                          <div className="relative w-full aspect-[3/4] overflow-hidden bg-[var(--background)]">
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              fill
                              className="object-cover transition-transform group-hover:scale-105"
                              sizes="(max-width: 640px) 45vw, 160px"
                            />
                            {/* Selected overlay */}
                            {isSelected && (
                              <div className="absolute inset-0 bg-[var(--fg-overlay-08)] flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Product info */}
                          <div className="p-2">
                            <p className="text-[12px] text-[var(--foreground-muted)] truncate">{product.brand}</p>
                            <p className="text-xs text-[var(--foreground)] leading-snug line-clamp-2">{product.name}</p>
                            <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">{f.money(product.priceMin)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {filteredProducts.length > shownProducts.length && (
                    <p className="text-xs text-[var(--foreground-subtle)] text-center pt-4">
                      Showing {shownProducts.length} of {filteredProducts.length} — refine the search or pick a category to find the rest.
                    </p>
                  )}
                  </>
                )}
              </div>
            </div>

            {/* ── RIGHT: Outfit composer ── */}
            <div className="lg:w-[45%] flex flex-col lg:overflow-y-auto lg:max-h-[600px]">
              <div className="px-5 py-4 flex flex-col gap-4">

                {/* Selected items */}
                <div>
                  <p className={labelCls}>
                    Selected items ({selectedItems.length}/{MAX_ITEMS})
                  </p>
                  {selectedItems.length === 0 ? (
                    <p className="text-xs text-[var(--foreground-subtle)] border border-dashed border-[var(--border)] rounded-xl px-3 py-4 text-center">
                      Click products on the left to add them
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selectedItems.map((item) => {
                        const colorKeys = Object.keys(item.product.colorImages ?? {});
                        const activeColor = item.selectedColor ?? colorKeys[0];
                        const thumbSrc =
                          activeColor && item.product.colorImages?.[activeColor]?.[0]
                            ? item.product.colorImages[activeColor][0]
                            : item.product.imageUrl;
                        return (
                        <div
                          key={item.product.id}
                          className="flex flex-col gap-2 border border-[var(--border)] rounded-xl p-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-12 flex-shrink-0 overflow-hidden rounded-lg">
                              <Image
                                src={thumbSrc}
                                alt={item.product.name}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[var(--foreground)] truncate">{item.product.name}</p>
                              <p className="text-[12px] text-[var(--foreground-muted)]">{item.product.brand} · {f.money(item.product.priceMin)}</p>
                            </div>
                            {/* Role */}
                            <select
                              value={item.role}
                              onChange={(e) => setRole(item.product.id, e.target.value as OutfitRole)}
                              className="text-[12px] rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] px-2 py-1 outline-none focus:border-[var(--foreground)]"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                              ))}
                            </select>
                            {/* Remove */}
                            <button
                              onClick={() => removeItem(item.product.id)}
                              aria-label={`Remove ${item.product.name}`}
                              className={`${BTN_ICON} shrink-0`}
                            >
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                          {/* Colour swatches (only for products with multiple colours) */}
                          {colorKeys.length > 1 && (
                            <div className="flex items-center gap-1.5 px-1 flex-wrap">
                              {colorKeys.map((color) => {
                                const previewImg = item.product.colorImages![color]?.[0];
                                const isActive = (item.selectedColor ?? colorKeys[0]) === color;
                                return (
                                  <button
                                    key={color}
                                    title={color}
                                    onClick={() => setSelectedColor(item.product.id, color)}
                                    className={`relative w-10 h-10 md:w-6 md:h-6 rounded-full overflow-hidden border transition-colors ${
                                      isActive
                                        ? "border-[var(--foreground)] ring-1 ring-[var(--foreground)]"
                                        : "border-[var(--border)] hover:border-[var(--foreground)]"
                                    }`}
                                  >
                                    {previewImg ? (
                                      <Image
                                        src={previewImg}
                                        alt={color}
                                        fill
                                        className="object-cover"
                                        sizes="24px"
                                      />
                                    ) : (
                                      <span className="flex w-full h-full items-center justify-center text-[11px] leading-none text-[var(--foreground-subtle)]">{color.charAt(0).toUpperCase()}</span>
                                    )}
                                  </button>
                                );
                              })}
                              <span className="text-[12px] text-[var(--foreground-subtle)] capitalize ml-1">{activeColor}</span>
                            </div>
                          )}
                        </div>
                        );
                      })}
                      {/* Price total */}
                      <div className="flex justify-between items-center pt-1 border-t border-[var(--border)]">
                        <span className="text-[12px] text-[var(--foreground-muted)]">Total</span>
                        <span className="text-sm text-[var(--foreground)]">
                          {f.moneyRange(priceMin, priceMax)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className={labelCls}>Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Outfit name"
                    className={inputCls}
                  />
                </div>

                {/* Occasion + Season */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Occasion</label>
                    <select
                      value={form.occasion}
                      onChange={(e) => setForm((f) => ({ ...f, occasion: e.target.value as Occasion }))}
                      className={selectCls}
                    >
                      {OCCASIONS.map((o) => (
                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Season</label>
                    <select
                      value={form.season}
                      onChange={(e) => setForm((f) => ({ ...f, season: e.target.value as Season }))}
                      className={selectCls}
                    >
                      {SEASONS.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the outfit..."
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                {/* Style keywords */}
                <div>
                  <label className={labelCls}>Style keywords</label>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLE_KEYWORDS.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => toggleKeyword(kw)}
                        aria-pressed={form.styleKeywords.includes(kw)}
                        className={`px-4 py-2 rounded-full border text-[12px] font-medium transition-colors duration-200 ${
                          form.styleKeywords.includes(kw)
                            ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                            : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {styleLabel(kw)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cover image upload */}
                <div>
                  <label className={labelCls}>Cover image</label>

                  {/* Preview */}
                  {form.imageUrl ? (
                    <div className="relative mb-2 w-full aspect-[4/3] overflow-hidden rounded-xl bg-[var(--background)]">
                      <Image
                        src={form.imageUrl}
                        alt="Cover preview"
                        fill
                        className="object-cover"
                        sizes="400px"
                        unoptimized={form.imageUrl.startsWith("blob:")}
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                        className="absolute top-2 right-2 w-10 h-10 md:w-6 md:h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-[13px] leading-none"
                        title="Remove image"
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className={`block cursor-pointer rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--foreground)] transition-colors text-center py-8 mb-2 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f);
                          e.target.value = "";
                        }}
                      />
                      <div className="flex flex-col items-center gap-1.5">
                        {uploading ? (
                          <span className="text-xs text-[var(--foreground-muted)]">Uploading…</span>
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[var(--foreground-subtle)]">
                              <path d="M10 3V14M10 3L6.5 6.5M10 3L13.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M3 17H17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            </svg>
                            <span className="text-xs text-[var(--foreground-muted)]">Click to upload</span>
                            <span className="text-[12px] text-[var(--foreground-subtle)]">PNG, JPG, WEBP, AVIF · max 10 MB</span>
                          </>
                        )}
                      </div>
                    </label>
                  )}

                  {uploadError && (
                    <p className="text-[12px] text-[var(--err)] mb-1.5">{uploadError}</p>
                  )}

                  {/* Manual URL fallback */}
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="Or paste image URL…"
                    className={inputCls}
                  />
                </div>

                {/* AI Generated */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isAIGenerated"
                    checked={form.isAIGenerated}
                    onChange={(e) => setForm((f) => ({ ...f, isAIGenerated: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-[var(--foreground)]"
                  />
                  <label htmlFor="isAIGenerated" className="text-xs text-[var(--foreground-muted)] tracking-wide cursor-pointer">
                    AI generated outfit
                  </label>
                </div>

                {/* Error */}
                {saveError && (
                  <p className="text-xs text-[var(--err)]">{saveError}</p>
                )}
              </div>

              {/* Modal footer */}
              <div className="mt-auto px-5 py-4 border-t border-[var(--border)] flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!form.name.trim() || saving}
                  className={`${btn("primary")} flex-1`}
                >
                  {saving ? "Saving..." : editingId ? "Save changes" : "Create outfit"}
                </button>
                <button
                  onClick={closeModal}
                  className={btn("ghost")}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
