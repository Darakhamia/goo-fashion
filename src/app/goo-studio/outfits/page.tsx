"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "@/components/ui/Image";
import type { Gender, Outfit, Season, StyleKeyword } from "@/lib/types";
import { STYLE_KEYWORD_LIST as STYLE_KEYWORDS, normalizeStyleKeywords, styleLabel } from "@/lib/style-keywords";
import { SEASON_LIST, normalizeSeasons, seasonsFromRow } from "@/lib/seasons";
import { GENDERS, normalizeGender, outfitGenderOf } from "@/lib/outfit-gender";
import { OUTFIT_KINDS, outfitKind, type OutfitKind } from "@/lib/outfit-kind";
import { useDownloadCards } from "@/components/admin/DownloadCardsButton";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { BANNER, btn, BTN_ICON, BTN_ICON_SM, FIELD_LABEL, INPUT } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT } from "@/app/goo-studio/_i18n";
import type { Key, T, Vars } from "@/app/goo-studio/_i18n";
import { DataTable, EmptyState, Thumb } from "@/components/admin/DataTable";
import { PageHeader, PLUS } from "@/components/admin/PageHeader";
import type { Column } from "@/components/admin/DataTable";
import { ActiveFilters, FilterBar, FilterChips, FilterMenu, SearchField } from "@/components/admin/FilterBar";
import { BulkBar } from "@/components/admin/BulkBar";
import { RowMenu } from "@/components/admin/Menu";
import type { MenuItem } from "@/components/admin/Menu";
import { Tabs, tabPanel } from "@/components/admin/Tabs";
import { Modal } from "@/components/admin/Modal";
import { Badge } from "@/components/admin/Badge";
import { AiGenerateDialog, AiLookNotes, AiRunPanel, SPARK, useAiRuns, type AiMeta } from "./ai-generator";

interface PendingLook {
  id: string;
  created_at: string;
  /** Null for a generated look whose picture failed; approval then publishes a collage. */
  generated_image: string | null;
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
  /** The single season before migration 030, and the list after it. */
  season: string | null;
  seasons?: string[] | null;
  /** Set when the AI put the look together (Generate with AI, migration 031). */
  ai_meta?: AiMeta | null;
  /** Who it is for (migration 032); null = read from the pieces at approval. */
  gender?: string | null;
}

/**
 * What the editor changes on a published outfit. Its pieces and price are the
 * look as it was built: changing those means building it again in the builder
 * (CEO, 2026-10-27), so the editor shows them and does not edit them.
 */
interface OutfitFormState {
  name: string;
  description: string;
  imageUrl: string;
  styleKeywords: StyleKeyword[];
  seasons: Season[];
  gender: Gender;
  isAIGenerated: boolean;
}

/** How a submitted look was drawn, as its badge reads it. */
const LOOK_STYLE_KEY: Record<string, Key> = {
  mannequin: "outfits.style.mannequin",
  flatlay: "outfits.style.flatlay",
  tryon: "outfits.style.tryon",
};

/**
 * What the approval endpoint names a look whose name box is left empty. It is
 * the published name, not interface text, so it stays the same in every
 * language (src/app/api/looks/approve/route.ts).
 */
const DEFAULT_LOOK_NAME = "Community Look";

/**
 * An error to show. The server's own words stay as they came; one of ours is
 * kept as its dictionary key, so it follows a language switch without the
 * loaders running again.
 */
type Failure = string | { key: Key; vars?: Vars };

function sayFailure(f: Failure, t: T): string {
  return typeof f === "string" ? f : t(f.key, f.vars);
}

const SEASON_KEY: Record<Season, Key> = {
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


/** An outfit's seasons in the admin's language: "Spring, Autumn", or "All seasons". */
function seasonsText(seasons: readonly Season[], t: T): string {
  return seasons.length ? seasons.map((s) => t(SEASON_KEY[s])).join(", ") : t("outfits.season.all");
}

/** Where outfits are made now: the builder, then My looks → Publish. */
const BUILDER_HREF = "/builder";

const defaultForm: OutfitFormState = {
  name: "",
  description: "",
  imageUrl: "",
  styleKeywords: [],
  seasons: [],
  gender: "unisex",
  isAIGenerated: false,
};

// The field recipe, full width in the editor.
const inputCls = `${INPUT} w-full`;

/** Chip classes, the same for styles and seasons. */
const chipCls = (on: boolean) =>
  `px-4 py-2 rounded-full border text-[12px] font-medium transition-colors duration-200 ${
    on
      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
      : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
  }`;

/**
 * Seasons as chips: any number of the four, and "All seasons" — which is
 * none picked — to clear them. Picking all four reads as "All seasons" too.
 */
function SeasonChips({ value, onChange, label }: { value: Season[]; onChange: (next: Season[]) => void; label: string }) {
  const t = useT();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      <button type="button" aria-pressed={value.length === 0} onClick={() => onChange([])} className={chipCls(value.length === 0)}>
        {t("outfits.season.all")}
      </button>
      {SEASON_LIST.map((season) => {
        const on = value.includes(season);
        return (
          <button
            key={season}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(normalizeSeasons(on ? value.filter((s) => s !== season) : [...value, season]))}
            className={chipCls(on)}
          >
            {t(SEASON_KEY[season])}
          </button>
        );
      })}
    </div>
  );
}

const GENDER_KEY: Record<Gender, Key> = {
  women: "outfits.gender.women",
  men: "outfits.gender.men",
  unisex: "outfits.gender.unisex",
};

/** Who put an outfit together, as the site marks it (lib/outfit-kind). */
const KIND_KEY: Record<OutfitKind, Key> = {
  community: "outfits.kind.community",
  ai: "outfits.kind.ai",
};

/**
 * Who an outfit is for, as chips: one of three. With `auto`, a fourth —
 * "From the pieces", none picked — leaves it to what the pieces add up to.
 */
function GenderChips({
  value,
  onChange,
  label,
  auto = false,
}: {
  value: Gender | null;
  onChange: (next: Gender | null) => void;
  label: string;
  auto?: boolean;
}) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {auto && (
        <button type="button" role="radio" aria-checked={value === null} onClick={() => onChange(null)} className={chipCls(value === null)}>
          {t("outfits.gender.auto")}
        </button>
      )}
      {GENDERS.map((g) => (
        <button key={g} type="button" role="radio" aria-checked={value === g} onClick={() => onChange(g)} className={chipCls(value === g)}>
          {t(GENDER_KEY[g])}
        </button>
      ))}
    </div>
  );
}

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
  const [outfitsError, setOutfitsError] = useState<Failure>("");
  /** The outfit open in the editor; its pieces show as they were built. */
  const [editing, setEditing] = useState<Outfit | null>(null);
  const [form, setForm] = useState<OutfitFormState>(defaultForm);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // A season, or "all" for the outfits set for every season.
  const [seasonFilter, setSeasonFilter] = useState<Season | "all" | "">("");
  const [genderFilter, setGenderFilter] = useState<Gender | "">("");
  const [homeFilter, setHomeFilter] = useState<"on" | "off" | "">("");
  // Who put it together (lib/outfit-kind) and a style it is tagged with.
  const [kindFilter, setKindFilter] = useState<OutfitKind | "">("");
  const [styleFilter, setStyleFilter] = useState<StyleKeyword | "">("");
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
  const [pendingError, setPendingError] = useState<Failure>("");
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
    seasons: [] as Season[],
    gender: null as Gender | null,
    styleKeywords: [] as StyleKeyword[],
  });

  const openSubmission = (look: PendingLook) => {
    setModeration({
      name: look.name ?? "",
      description: look.description ?? "",
      seasons: seasonsFromRow(look),
      gender: normalizeGender(look.gender),
      styleKeywords: normalizeStyleKeywords(look.style_keywords),
    });
    setModerationError("");
    setRedrawStyle(look.generated_style === "flatlay" ? "flatlay" : "mannequin");
    setRewriteNotes([]);
    setSelectedLook(look);
  };

  // ── Redo in review: the picture, the words (api/admin/pending-looks/[id]) ──
  const [redrawStyle, setRedrawStyle] = useState<"mannequin" | "flatlay">("mannequin");
  const [redrawing, setRedrawing] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  /** What the copy checks changed in the last rewrite, shown under the fields. */
  const [rewriteNotes, setRewriteNotes] = useState<string[]>([]);

  const redrawPicture = async (look: PendingLook) => {
    setRedrawing(true);
    setModerationError("");
    try {
      const res = await fetch(`/api/admin/pending-looks/${look.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: redrawStyle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.imageUrl) {
        setModerationError(data.error ?? t("outfits.review.redrawFailed", { status: res.status }));
        return;
      }
      const updated = { ...look, generated_image: data.imageUrl as string, generated_style: redrawStyle };
      if (updated.ai_meta?.imageError) updated.ai_meta = { ...updated.ai_meta, imageError: undefined };
      setSelectedLook((cur) => (cur?.id === look.id ? updated : cur));
      setPendingLooks((prev) => prev.map((l) => (l.id === look.id ? updated : l)));
    } catch {
      setModerationError(t("outfits.review.redrawFailedNetwork"));
    } finally {
      setRedrawing(false);
    }
  };

  const rewriteCopy = async (look: PendingLook) => {
    setRewriting(true);
    setModerationError("");
    try {
      const res = await fetch(`/api/admin/pending-looks/${look.id}/copy`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.name !== "string") {
        setModerationError(data.error ?? t("outfits.review.rewriteFailed", { status: res.status }));
        return;
      }
      setModeration((m) => ({ ...m, name: data.name, description: data.description ?? m.description }));
      const notes = (Array.isArray(data.notes) ? data.notes : []) as NonNullable<AiMeta["copy"]>;
      setRewriteNotes(
        notes
          .filter((n) => n.action === "replaced")
          .map((n) =>
            t("outfits.ai.copy.replaced", {
              field: t(n.field === "name" ? "outfits.editor.name" : "outfits.editor.description"),
              problem: n.problem,
            }),
          ),
      );
    } catch {
      setModerationError(t("outfits.review.rewriteFailedNetwork"));
    } finally {
      setRewriting(false);
    }
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
        setOutfitsError(data?.error ?? { key: "outfits.loadFailed", vars: { status: res.status } });
        return;
      }
      setOutfits(data);
      setOutfitsError("");
    } catch {
      setOutfitsError({ key: "outfits.loadFailedNetwork" });
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
        setPendingError(data?.error ?? { key: "outfits.pending.loadFailed", vars: { status: res.status } });
        return;
      }
      setPendingLooks(
        (data as PendingLook[]).map((l) => ({ ...l, style_keywords: normalizeStyleKeywords(l.style_keywords) })),
      );
      setPendingError("");
    } catch {
      setPendingError({ key: "outfits.pending.loadFailedNetwork" });
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    loadOutfits();
    loadPending();
  }, [loadOutfits, loadPending]);

  // Generate with AI: the runs, followed while one goes; each outfit it makes
  // lands in the queue, which is read again as they do.
  const [aiOpen, setAiOpen] = useState(false);
  const ai = useAiRuns(loadPending);
  const openAi = () => {
    setAiOpen(true);
    void ai.reload(true);
  };

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
            seasons: moderation.seasons,
            // null: what was submitted, else what the pieces add up to.
            gender: moderation.gender,
            styleKeywords: normalizeStyleKeywords(moderation.styleKeywords),
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setModerationError(err.error ?? t("outfits.review.approveFailed", { status: res.status }));
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
      setModerationError(t("outfits.review.approveFailedNetwork"));
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectLook = async (id: string) => {
    if (!(await confirm({
      title: t("outfits.review.rejectTitle"),
      body: t("outfits.review.rejectBody"),
      confirmLabel: t("outfits.review.rejectAction"),
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
        setModerationError(err.error ?? t("outfits.review.rejectFailed", { status: res.status }));
        return;
      }
      setPendingLooks((prev) => prev.filter((l) => l.id !== id));
      setSelectedLook(null);
    } catch {
      setModerationError(t("outfits.review.rejectFailedNetwork"));
    } finally {
      setApprovingId(null);
    }
  };

  const openEditModal = (outfit: Outfit) => {
    setEditing(outfit);
    setForm({
      name: outfit.name,
      description: outfit.description,
      imageUrl: outfit.imageUrl,
      styleKeywords: outfit.styleKeywords,
      seasons: outfit.seasons ?? [],
      gender: outfitGenderOf(outfit),
      isAIGenerated: outfit.isAIGenerated,
    });
    setSaveError("");
    setUploadError("");
  };

  const closeModal = () => setEditing(null);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? t("outfits.editor.uploadFailed"));
      } else {
        setForm((f) => ({ ...f, imageUrl: json.url }));
      }
    } catch {
      setUploadError(t("outfits.editor.uploadNetwork"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editing || !form.name.trim()) return;
    setSaving(true);
    setSaveError("");

    // Only what the editor changes; the pieces and the price stay as built.
    const body = {
      name: form.name.trim(),
      description: form.description,
      imageUrl: form.imageUrl,
      styleKeywords: normalizeStyleKeywords(form.styleKeywords),
      seasons: form.seasons,
      gender: form.gender,
      isAIGenerated: form.isAIGenerated,
    };

    try {
      const res = await fetch(`/api/outfits/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Any failure keeps the editor open with the reason.
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error ?? t("outfits.editor.saveFailed", { status: res.status }));
        return;
      }

      const saved: Outfit = await res.json();
      setOutfits((prev) => prev.map((o) => (o.id === saved.id ? saved : o)));
      closeModal();
    } catch {
      setSaveError(t("outfits.editor.saveNetwork"));
    } finally {
      setSaving(false);
    }
  };

  // ── Rows in the table, and the ones ticked ─────────────────────────────────

  const filteredOutfits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = outfits.filter((o) => {
      if (seasonFilter === "all" && o.seasons.length > 0) return false;
      if (seasonFilter && seasonFilter !== "all" && !o.seasons.includes(seasonFilter)) return false;
      if (genderFilter && outfitGenderOf(o) !== genderFilter) return false;
      if (homeFilter && !!o.isHomepageFeatured !== (homeFilter === "on")) return false;
      if (kindFilter && outfitKind(o) !== kindFilter) return false;
      if (styleFilter && !o.styleKeywords.includes(styleFilter)) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        seasonsText(o.seasons, t).toLowerCase().includes(q) ||
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
  }, [outfits, searchQuery, seasonFilter, genderFilter, homeFilter, kindFilter, styleFilter, sortKey, t]);

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
        toast.err(err.error ?? t("outfits.featureFailed", { status: res.status }));
      }
    } catch {
      toast.err(t("outfits.featureFailedNetwork"));
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
        toast.err(err.error ?? t("outfits.deleteFailed", { status: res.status }));
      }
    } catch {
      toast.err(t("outfits.deleteFailedNetwork"));
    }
  };

  const toggleKeyword = (kw: StyleKeyword) => {
    setForm((f) => ({
      ...f,
      styleKeywords: f.styleKeywords.includes(kw)
        ? f.styleKeywords.filter((k) => k !== kw)
        : [...f.styleKeywords, kw],
    }));
  };

  // ── The table ─────────────────────────────────────────────────────────────

  const featuredCount = outfits.filter((o) => o.isHomepageFeatured).length;
  const aiCount = outfits.filter((o) => o.isAIGenerated).length;

  const clearFilters = () => {
    setSearchQuery("");
    setSeasonFilter("");
    setGenderFilter("");
    setHomeFilter("");
    setKindFilter("");
    setStyleFilter("");
  };

  const activeFilters = [
    ...(kindFilter
      ? [{ key: "kind", label: `${t("outfits.f.kind")}: ${t(KIND_KEY[kindFilter])}`, onRemove: () => setKindFilter("") }]
      : []),
    ...(styleFilter
      ? [{ key: "style", label: `${t("outfits.f.style")}: ${styleLabel(styleFilter)}`, onRemove: () => setStyleFilter("") }]
      : []),
    ...(seasonFilter
      ? [
          {
            key: "season",
            label: `${t("outfits.f.season")}: ${t(seasonFilter === "all" ? "outfits.season.all" : SEASON_KEY[seasonFilter])}`,
            onRemove: () => setSeasonFilter(""),
          },
        ]
      : []),
    ...(genderFilter
      ? [{ key: "gender", label: `${t("outfits.f.gender")}: ${t(GENDER_KEY[genderFilter])}`, onRemove: () => setGenderFilter("") }]
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
  const tableResetKey = [searchQuery, seasonFilter, genderFilter, homeFilter, kindFilter, styleFilter, sortKey].join("|");

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
    {
      key: "kind",
      header: t("outfits.col.kind"),
      hide: "md",
      cell: (o) => {
        const kind = outfitKind(o);
        // The AI's in the queue's own mark (inverse), a person's plain.
        return <Badge tone={kind === "ai" ? "inverse" : "neutral"}>{t(KIND_KEY[kind])}</Badge>;
      },
    },
    { key: "gender", header: t("outfits.col.gender"), hide: "lg", cell: (o) => t(GENDER_KEY[outfitGenderOf(o)]) },
    { key: "season", header: t("outfits.col.season"), hide: "md", cell: (o) => seasonsText(o.seasons, t) },
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
      {/* Header: what the open tab holds, and its actions. The looks in the
          table — the ticked ones, or all of them — download as pictures with
          the cards of their pieces, as one ZIP. */}
      <PageHeader
        title={t("nav.outfits")}
        subtitle={
          adminTab === "pending"
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
                  ].join(" · ")
        }
        status={
          adminTab === "outfits" && cards.busy
            ? cards.received
              ? t("cards.packingMb", { mb: (cards.received / (1024 * 1024)).toFixed(1) })
              : t("cards.packing")
            : undefined
        }
        actions={
          adminTab === "outfits"
            ? [{ key: "cards", label: t("cards.download"), onClick: () => void cards.download(exportIds), disabled: cards.busy || outfits.length === 0 }]
            : []
        }
        primary={
          adminTab === "outfits"
            ? { key: "add", label: t("outfits.add"), title: t("outfits.addHint"), icon: PLUS, href: BUILDER_HREF }
            : { key: "ai", label: t("outfits.ai.generate"), title: t("outfits.ai.intro"), icon: SPARK, onClick: openAi }
        }
      />

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
          {ai.latest && <AiRunPanel key={ai.latest.id} run={ai.latest} />}
          {pendingError && (
            <div role="alert" className={`${BANNER.err} mb-4 flex items-center justify-between`}>
              <span>{sayFailure(pendingError, t)}</span>
              <button
                onClick={() => {
                  setLoadingPending(true);
                  loadPending();
                }}
                className="ml-4 underline underline-offset-4 opacity-80 hover:opacity-100 transition-opacity"
              >
                {t("common.retry")}
              </button>
            </div>
          )}
          {loadingPending ? (
            <p className="text-xs text-[var(--foreground-subtle)] py-8 text-center">{t("common.loading")}</p>
          ) : pendingError && pendingLooks.length === 0 ? null : pendingLooks.length === 0 ? (
            <EmptyState
              text={t("outfits.pending.empty")}
              action={
                <button onClick={openAi} className={btn("secondary")}>
                  {t("outfits.ai.generate")}
                </button>
              }
            />
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
                    <img
                      src={look.generated_image ?? look.pieces[0]?.imageUrl ?? ""}
                      alt={t("outfits.pending.lookAlt")}
                      className={`w-full h-full ${look.generated_image ? "object-cover" : "object-contain p-1"}`}
                    />
                  </div>
                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {look.ai_meta && <Badge tone="inverse">{t("outfits.ai.badge")}</Badge>}
                      {look.generated_style && <Badge>{t(LOOK_STYLE_KEY[look.generated_style] ?? "outfits.style.ai")}</Badge>}
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
                      {" · "}{t("outfits.pending.pieces", { count: look.pieces.length })}
                    </p>
                  </div>
                  {/* Arrow */}
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0 text-[var(--foreground-subtle)]">
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
          label={t("outfits.review.title")}
          panelClassName="w-full max-w-3xl max-h-[90dvh] flex flex-col rounded-2xl overflow-y-auto md:overflow-hidden"
        >
          {/* Modal header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              {selectedLook.ai_meta && <Badge tone="inverse">{t("outfits.ai.badge")}</Badge>}
              {selectedLook.generated_style && (
                <Badge>{t(LOOK_STYLE_KEY[selectedLook.generated_style] ?? "outfits.style.ai")}</Badge>
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
              aria-label={t("common.close")}
              title={t("common.close")}
              className={BTN_ICON}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Body: image left, pieces right; stacked on phones, where the
              whole dialog scrolls instead of each column. */}
          <div className="flex flex-col md:flex-row shrink-0 md:shrink md:min-h-0 md:flex-1 md:overflow-hidden">
            {/* Generated image — the whole of it (it is square; covering the
                column cut its edges off), with the controls to draw it again. */}
            <div className="relative w-full h-80 md:h-auto md:w-[55%] shrink-0 bg-[var(--background)] overflow-hidden flex flex-col">
              <div className="relative flex-1 min-h-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedLook.generated_image ?? selectedLook.pieces[0]?.imageUrl ?? ""}
                  alt={t("outfits.review.imageAlt")}
                  className={`absolute inset-0 w-full h-full object-contain ${selectedLook.generated_image ? "" : "p-6"}`}
                />
                {redrawing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-overlay-90)] text-[13px] text-[var(--foreground)]" role="status">
                    {t("outfits.review.redrawing")}
                  </div>
                )}
              </div>
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--surface)]">
                <FilterChips
                  label={t("outfits.ai.photo")}
                  value={redrawStyle}
                  options={[
                    { value: "mannequin", label: t("outfits.ai.photo.mannequin") },
                    { value: "flatlay", label: t("outfits.ai.photo.flatlay") },
                  ]}
                  onChange={(v) => setRedrawStyle(v as "mannequin" | "flatlay")}
                />
                <button
                  type="button"
                  onClick={() => void redrawPicture(selectedLook)}
                  disabled={redrawing || approvingId === selectedLook.id}
                  className={`${btn("secondary", "sm")} inline-flex items-center gap-1.5`}
                >
                  {SPARK}
                  {t(redrawing ? "outfits.review.redrawingShort" : "outfits.review.redraw")}
                </button>
              </div>
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
                  <p className="text-xs text-[var(--foreground-subtle)]">{t("outfits.review.noPieces")}</p>
                </div>
              )}
            </div>
          </div>

          {/* What the catalogue will show.
              Prefilled from the submission, so approving unchanged publishes
              exactly what the shopper wrote; empty means the approval
              endpoint keeps its own fallback rather than publishing blanks. */}
          <div className="px-5 py-4 border-t border-[var(--border)] shrink-0 md:max-h-[38vh] md:overflow-y-auto">
            {selectedLook.ai_meta && <AiLookNotes meta={selectedLook.ai_meta} />}
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[13px] font-medium text-[var(--foreground)]">
                {t("outfits.review.publishAs")}
              </p>
              <button
                type="button"
                onClick={() => void rewriteCopy(selectedLook)}
                disabled={rewriting || approvingId === selectedLook.id}
                className={`${btn("ghost", "sm")} inline-flex items-center gap-1.5`}
              >
                {SPARK}
                {t(rewriting ? "outfits.review.rewriting" : "outfits.review.rewrite")}
              </button>
            </div>

            {/* The placeholder is the name an empty box publishes under. */}
            <input
              type="text"
              value={moderation.name}
              onChange={(e) => setModeration((m) => ({ ...m, name: e.target.value }))}
              placeholder={DEFAULT_LOOK_NAME}
              aria-label={t("outfits.editor.name")}
              maxLength={120}
              className={`${inputCls} mb-3`}
            />

            <textarea
              value={moderation.description}
              onChange={(e) => setModeration((m) => ({ ...m, description: e.target.value }))}
              placeholder={t("outfits.review.description")}
              aria-label={t("outfits.editor.description")}
              rows={3}
              maxLength={2000}
              className={`${inputCls} resize-none mb-3`}
            />
            {rewriteNotes.length > 0 && (
              <ul className="-mt-1.5 mb-3 space-y-0.5 text-[12px] text-[var(--foreground-muted)]">
                {rewriteNotes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}

            <p className={FIELD_LABEL}>{t("outfits.editor.styles")}</p>
            <div role="group" aria-label={t("outfits.editor.styles")} className="flex flex-wrap gap-1.5 mb-3">
              {STYLE_KEYWORDS.map((kw) => {
                const on = moderation.styleKeywords.includes(kw);
                return (
                  <button key={kw} type="button" onClick={() => toggleModerationStyle(kw)} aria-pressed={on} className={chipCls(on)}>
                    {styleLabel(kw)}
                  </button>
                );
              })}
            </div>

            <p className={FIELD_LABEL}>{t("outfits.editor.seasons")}</p>
            <SeasonChips
              label={t("outfits.editor.seasons")}
              value={moderation.seasons}
              onChange={(seasons) => setModeration((m) => ({ ...m, seasons }))}
            />

            <p className={`${FIELD_LABEL} mt-3`}>{t("outfits.editor.gender")}</p>
            <GenderChips
              auto
              label={t("outfits.editor.gender")}
              value={moderation.gender}
              onChange={(gender) => setModeration((m) => ({ ...m, gender }))}
            />
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-[var(--border)] shrink-0">
            {moderationError && (
              <p role="alert" className={`${BANNER.err} mb-3`}>
                {moderationError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handleApproveLook(selectedLook.id)}
                disabled={approvingId === selectedLook.id}
                className={`${btn("primary")} flex-1`}
              >
                {approvingId === selectedLook.id ? t("outfits.review.approving") : t("outfits.review.approve")}
              </button>
              <button
                onClick={() => handleRejectLook(selectedLook.id)}
                disabled={approvingId === selectedLook.id}
                className={`${btn("danger")} flex-1`}
              >
                {t("outfits.review.reject")}
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
            <FilterBar
              search={
                <SearchField
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t("outfits.search.placeholder")}
                  label={t("outfits.search.label")}
                />
              }
              active={activeFilters.length}
              onClearAll={clearFilters}
              shown={filteredOutfits.length}
            >
              <FilterMenu
                label={t("outfits.f.kind")}
                value={kindFilter}
                options={OUTFIT_KINDS.map((k) => ({ value: k, label: t(KIND_KEY[k]) }))}
                onChange={(v) => setKindFilter(v as OutfitKind | "")}
                allLabel={t("filter.all")}
              />
              <FilterMenu
                label={t("outfits.f.style")}
                value={styleFilter}
                options={STYLE_KEYWORDS.map((s) => ({ value: s, label: styleLabel(s) }))}
                onChange={(v) => setStyleFilter(v as StyleKeyword | "")}
                allLabel={t("filter.all")}
              />
              <FilterMenu
                label={t("outfits.f.season")}
                value={seasonFilter}
                options={[
                  ...SEASON_LIST.map((s) => ({ value: s, label: t(SEASON_KEY[s]) })),
                  { value: "all", label: t("outfits.season.all") },
                ]}
                onChange={(v) => setSeasonFilter(v as Season | "all" | "")}
                allLabel={t("filter.all")}
              />
              <FilterMenu
                label={t("outfits.f.gender")}
                value={genderFilter}
                options={GENDERS.map((g) => ({ value: g, label: t(GENDER_KEY[g]) }))}
                onChange={(v) => setGenderFilter(v as Gender | "")}
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
            </FilterBar>
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
            card={(o) => ({
              thumb: <Thumb src={o.imageUrl} fit="cover" size="lg" />,
              title: o.name,
              meta: [
                seasonsText(o.seasons, t),
                f.moneyRange(o.totalPriceMin, o.totalPriceMax),
                ...(o.isHomepageFeatured ? [t("outfits.home.on")] : []),
              ].join(" · "),
            })}
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
                  <p className="text-[13px] text-[var(--err)] break-words">{sayFailure(outfitsError, t)}</p>
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
                      <Link href={BUILDER_HREF} className={btn("primary")}>
                        {t("outfits.add")}
                      </Link>
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

      {aiOpen && (
        <AiGenerateDialog onClose={() => setAiOpen(false)} onStarted={() => void ai.reload()} ready={ai.ready} options={ai.options} />
      )}

      {/* ── Editor: the words, styles, seasons and cover of a published outfit ── */}
      {editing && (
        <Modal
          onClose={closeModal}
          label={t("outfits.editor.edit")}
          panelClassName="rounded-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto overscroll-contain flex flex-col"
          closeOnScrim={false}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
            <h2 className="font-display text-xl font-light text-[var(--foreground)]">{t("outfits.editor.edit")}</h2>
            <button onClick={closeModal} aria-label={t("common.close")} title={t("common.close")} className={BTN_ICON}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 flex flex-col gap-5">
            {/* The pieces, as the look was built. Changing them is building
                the look again: the builder, then My looks → Publish. */}
            <div>
              <p className={FIELD_LABEL}>{t("outfits.editor.pieces", { count: editing.items.length })}</p>
              <ul className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {editing.items.map((item) => {
                  const colour = item.selectedColor;
                  const src = (colour && item.product.colorImages?.[colour]?.[0]) || item.product.imageUrl;
                  return (
                    <li key={`${item.product.id}-${colour ?? ""}`} className="flex items-center gap-3 px-3 py-2">
                      <Thumb src={src} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--foreground)] truncate">{item.product.name}</p>
                        <p className="text-[12px] text-[var(--foreground-muted)] truncate">
                          {[item.product.brand, colour].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="text-[12px] text-[var(--foreground-muted)] tabular-nums shrink-0">{f.money(item.product.priceMin)}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[12px] text-[var(--foreground-muted)]">{t("outfits.editor.total")}</span>
                <span className="text-sm text-[var(--foreground)] tabular-nums">{f.moneyRange(editing.totalPriceMin, editing.totalPriceMax)}</span>
              </div>
              <p className="text-[12px] text-[var(--foreground-muted)] mt-1">
                {t("outfits.editor.piecesNote")}{" "}
                <Link href={BUILDER_HREF} className="underline underline-offset-2 hover:text-[var(--foreground)]">
                  {t("outfits.editor.openBuilder")}
                </Link>
              </p>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="outfit-name" className={FIELD_LABEL}>{t("outfits.editor.name")} *</label>
              <input
                id="outfit-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("outfits.editor.namePlaceholder")}
                maxLength={120}
                className={inputCls}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="outfit-description" className={FIELD_LABEL}>{t("outfits.editor.description")}</label>
              <textarea
                id="outfit-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("outfits.editor.descriptionPlaceholder")}
                rows={3}
                maxLength={2000}
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Styles */}
            <div>
              <p className={FIELD_LABEL}>{t("outfits.editor.styles")}</p>
              <div role="group" aria-label={t("outfits.editor.styles")} className="flex flex-wrap gap-1.5">
                {STYLE_KEYWORDS.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => toggleKeyword(kw)}
                    aria-pressed={form.styleKeywords.includes(kw)}
                    className={chipCls(form.styleKeywords.includes(kw))}
                  >
                    {styleLabel(kw)}
                  </button>
                ))}
              </div>
            </div>

            {/* Seasons */}
            <div>
              <p className={FIELD_LABEL}>{t("outfits.editor.seasons")}</p>
              <SeasonChips
                label={t("outfits.editor.seasons")}
                value={form.seasons}
                onChange={(seasons) => setForm((f) => ({ ...f, seasons }))}
              />
            </div>

            {/* Who it is for */}
            <div>
              <p className={FIELD_LABEL}>{t("outfits.editor.gender")}</p>
              <GenderChips
                label={t("outfits.editor.gender")}
                value={form.gender}
                onChange={(gender) => setForm((f) => ({ ...f, gender: gender ?? "unisex" }))}
              />
            </div>

            {/* Cover image */}
            <div>
              <p className={FIELD_LABEL}>{t("outfits.editor.cover")}</p>
              {form.imageUrl ? (
                <div className="relative mb-2 w-full max-w-[240px] aspect-[3/4] overflow-hidden rounded-xl bg-[var(--background)]">
                  <Image
                    src={form.imageUrl}
                    alt={t("outfits.editor.coverAlt")}
                    fill
                    className="object-cover"
                    sizes="240px"
                    unoptimized={form.imageUrl.startsWith("blob:")}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    className="absolute top-2 right-2 w-10 h-10 md:w-6 md:h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-[13px] leading-none"
                    title={t("outfits.editor.removeImage")}
                    aria-label={t("outfits.editor.removeImage")}
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
                      <span className="text-xs text-[var(--foreground-muted)]">{t("outfits.editor.uploading")}</span>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="text-[var(--foreground-subtle)]">
                          <path d="M10 3V14M10 3L6.5 6.5M10 3L13.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M3 17H17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                        <span className="text-xs text-[var(--foreground-muted)]">{t("outfits.editor.upload")}</span>
                        <span className="text-[12px] text-[var(--foreground-subtle)]">{t("outfits.editor.uploadHint")}</span>
                      </>
                    )}
                  </div>
                </label>
              )}

              {uploadError && <p className="text-[12px] text-[var(--err)] mb-1.5">{uploadError}</p>}

              {/* Manual URL fallback */}
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder={t("outfits.editor.imageUrl")}
                aria-label={t("outfits.editor.imageUrl")}
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
                {t("outfits.editor.ai")}
              </label>
            </div>

            {saveError && <p role="alert" className="text-xs text-[var(--err)]">{saveError}</p>}
          </div>

          <div className="mt-auto px-6 py-4 border-t border-[var(--border)] flex gap-3">
            <button onClick={handleSave} disabled={!form.name.trim() || saving} className={`${btn("primary")} flex-1`}>
              {saving ? t("common.saving") : t("outfits.editor.save")}
            </button>
            <button onClick={closeModal} className={btn("ghost")}>
              {t("common.cancel")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
