"use client";

import { useState, useEffect, useCallback } from "react";
import type { BlogPost } from "@/lib/types";
import { estimateReadTime, slugify } from "@/lib/blog-render";
import { BLOG_CATEGORIES } from "@/lib/blog-categories";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { btn, BTN_ICON, BTN_ICON_SM, FIELD_LABEL } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT } from "@/app/goo-studio/_i18n";
import type { Key, Vars } from "@/app/goo-studio/_i18n";
import { DataTable, EmptyState, Thumb } from "@/components/admin/DataTable";
import type { Column } from "@/components/admin/DataTable";
import { ActiveFilters, FilterChips, FilterMenu, SearchField } from "@/components/admin/FilterBar";
import { RowMenu } from "@/components/admin/Menu";
import type { MenuItem } from "@/components/admin/Menu";
import { Badge } from "@/components/admin/Badge";
import { PageHeader, PLUS } from "@/components/admin/PageHeader";
import { Modal } from "@/components/admin/Modal";
import { Tabs, tabPanel } from "@/components/admin/Tabs";

interface BlogFormState {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  coverImageUrl: string;
  readTime: string;
  authorName: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  isPublished: boolean;
  publishedAt: string;
}

const defaultForm: BlogFormState = {
  slug: "",
  title: "",
  excerpt: "",
  body: "",
  category: "",
  coverImageUrl: "",
  readTime: "1 min",
  authorName: "GOO",
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
  isPublished: true,
  publishedAt: "",
};

/** Modes of the AI draft modal — a URL to rewrite, or a brief to announce. */
type AiMode = "url" | "brief";

/**
 * A message to show: the server's own words as they came, or a dictionary key.
 * Kept as a key where a callback that outlives a language switch sets it, so
 * the text still follows the admin language.
 */
type Msg = string | { key: Key; vars?: Vars };

type StatusFilter = "" | "published" | "draft";
type SortKey = "newest" | "oldest" | "title";
const SORT_OPTIONS: { value: SortKey; label: Key }[] = [
  { value: "newest", label: "blog.sort.newest" },
  { value: "oldest", label: "blog.sort.oldest" },
  { value: "title", label: "blog.sort.titleAsc" },
];

/** A draft has no publication date yet; it sorts by when it was written. */
const postTime = (p: BlogPost) => Date.parse(p.isPublished ? p.publishedAt : p.createdAt) || 0;

/** The field without its text size, so a call site can pick one without a clash. */
const fieldBase =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";
const inputCls = `${fieldBase} text-sm`;

/**
 * ISO timestamp → the "YYYY-MM-DDTHH:mm" a datetime-local input expects, in
 * the admin's own time zone. Slicing toISOString() gave UTC, which the input
 * then read back as local time — every save shifted the date by the offset.
 */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function AdminBlogPage() {
  const t = useT();
  const f = useFormat();
  const say = (m: Msg) => (typeof m === "string" ? m : t(m.key, m.vars));
  const confirm = useConfirm();
  const toast = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogFormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [loadError, setLoadError] = useState<Msg | null>(null);

  const [autoSlug, setAutoSlug] = useState(true);
  const [autoReadTime, setAutoReadTime] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSeo, setShowSeo] = useState(false);

  // AI generation
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>("url");
  const [aiUrl, setAiUrl] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadPosts = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch("/api/blog")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          setLoadError(data?.error ?? { key: "blog.loadFailedHttp", vars: { status: r.status } });
          return;
        }
        // A 200 that is not a list (e.g. an expired session answered with the
        // sign-in page) is a failed load too, not an empty blog.
        if (!Array.isArray(data)) {
          setLoadError({ key: "blog.loadFailedShape" });
          return;
        }
        setPosts(data);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : { key: "common.networkError" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(defaultForm);
    setAutoSlug(true);
    setAutoReadTime(true);
    setShowAdvanced(false);
    setShowSeo(false);
    setSaveError("");
    setShowModal(true);
  };

  const openEditModal = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      category: post.category,
      coverImageUrl: post.coverImageUrl,
      readTime: post.readTime,
      authorName: post.authorName,
      metaTitle: post.metaTitle ?? "",
      metaDescription: post.metaDescription ?? "",
      ogImage: post.ogImage ?? "",
      isPublished: post.isPublished,
      publishedAt: post.publishedAt ? toLocalInputValue(post.publishedAt) : "",
    });
    setAutoSlug(false);
    setAutoReadTime(false);
    setShowAdvanced(false);
    setShowSeo(false);
    setSaveError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleTitleChange = (v: string) => {
    setForm((f) => ({
      ...f,
      title: v,
      slug: autoSlug ? slugify(v) : f.slug,
    }));
  };

  const handleBodyChange = (v: string) => {
    setForm((f) => ({
      ...f,
      body: v,
      readTime: autoReadTime ? estimateReadTime(v) : f.readTime,
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setSaveError(t("blog.editor.titleRequired"));
      return;
    }
    const finalSlug = form.slug.trim() || slugify(form.title);
    if (!finalSlug) {
      setSaveError(t("blog.editor.slugFailed"));
      return;
    }

    setSaving(true);
    setSaveError("");

    // The field holds local time without a zone, which new Date() reads as
    // local — so this is the admin's intended moment. A date left untouched
    // goes back exactly as stored (seconds included), not rounded to the minute.
    const storedPublishedAt = editingId
      ? posts.find((p) => p.id === editingId)?.publishedAt
      : undefined;
    const publishedAt = !form.publishedAt
      ? undefined
      : storedPublishedAt && toLocalInputValue(storedPublishedAt) === form.publishedAt
      ? storedPublishedAt
      : new Date(form.publishedAt).toISOString();

    const body = {
      ...form,
      slug: finalSlug,
      publishedAt,
    };

    try {
      const url = editingId ? `/api/blog/${editingId}` : "/api/blog";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error ?? t("blog.editor.saveFailed"));
        return;
      }

      const saved: BlogPost = await res.json();
      if (editingId) {
        setPosts((prev) => prev.map((p) => (p.id === editingId ? saved : p)));
      } else {
        setPosts((prev) => [saved, ...prev]);
      }
      closeModal();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("common.networkError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (!(await confirm({
      title: t("blog.confirm.delete", { name: post.title }),
      body: t("blog.confirm.deleteBody"),
      confirmLabel: t("blog.confirm.deleteAction"),
      tone: "danger",
    }))) return;
    try {
      const res = await fetch(`/api/blog/${post.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.err(t("blog.deleteFailed", { error: err.error ?? `HTTP ${res.status}` }));
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e) {
      toast.err(t("blog.deleteFailed", { error: e instanceof Error ? e.message : t("common.networkError") }));
    }
  };

  const openAiModal = () => {
    setAiMode("url");
    setAiUrl("");
    setAiBrief("");
    setAiError("");
    setShowAiModal(true);
  };

  const aiInputReady = aiMode === "url" ? aiUrl.trim().length > 0 : aiBrief.trim().length >= 12;

  const handleAiGenerate = async () => {
    if (!aiInputReady) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/admin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          aiMode === "url" ? { url: aiUrl.trim() } : { brief: aiBrief.trim() }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? t("blog.ai.failed"));
        return;
      }
      setShowAiModal(false);
      setEditingId(null);
      setForm({
        ...defaultForm,
        // Unreviewed AI text opens as a draft: the main button reads "Save
        // draft", and going live is a deliberate flip of the toggle.
        isPublished: false,
        title: data.title ?? "",
        slug: data.slug ?? "",
        excerpt: data.excerpt ?? "",
        body: data.body ?? "",
        category: data.category ?? "",
        coverImageUrl: data.coverImageUrl ?? "",
        metaTitle: data.metaTitle ?? "",
        metaDescription: data.metaDescription ?? "",
        readTime: data.body ? estimateReadTime(data.body) : "1 min",
      });
      setAutoSlug(false);
      setAutoReadTime(false);
      setShowAdvanced(false);
      setShowSeo(false);
      setSaveError("");
      setShowModal(true);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t("common.networkError"));
    } finally {
      setAiLoading(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredPosts = posts
    .filter((p) => (statusFilter === "" ? true : statusFilter === "published" ? p.isPublished : !p.isPublished))
    .filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    )
    .sort((a, b) =>
      sortKey === "title" ? a.title.localeCompare(b.title) : sortKey === "oldest" ? postTime(a) - postTime(b) : postTime(b) - postTime(a)
    );

  const publishedCount = posts.filter((p) => p.isPublished).length;
  const draftCount = posts.length - publishedCount;

  const rowItems = (post: BlogPost): MenuItem[] => [
    // Also an icon beside the menu; on a phone the icon gives its room to the title.
    { label: t("blog.row.editShort"), onSelect: () => openEditModal(post) },
    {
      // A draft has no public page yet.
      label: t("blog.row.view"),
      onSelect: () => window.open(`/blog/${post.slug}`, "_blank", "noopener,noreferrer"),
      disabled: !post.isPublished,
    },
    { kind: "separator" },
    { label: t("blog.row.delete"), onSelect: () => void handleDelete(post), tone: "danger" },
  ];

  const columns: Column<BlogPost>[] = [
    {
      key: "post",
      header: t("blog.col.post"),
      grow: true,
      cell: (p) => (
        <div className="flex items-center gap-3 min-w-0">
          <Thumb src={p.coverImageUrl} fit="cover" />
          <div className="min-w-0">
            <div className="font-medium truncate" title={p.title}>
              {p.title}
            </div>
            <div className="text-[12px] text-[var(--foreground-muted)] truncate" title={`/blog/${p.slug}`}>
              {p.category || `/${p.slug}`}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: t("blog.col.status"),
      cell: (p) =>
        p.isPublished ? (
          <Badge tone="ok" dot>
            {t("blog.status.published")}
          </Badge>
        ) : (
          <Badge dot>{t("blog.status.draft")}</Badge>
        ),
    },
    {
      // Only the meta description itself counts: the excerpt standing in for it
      // is not one (GS4-10).
      key: "seo",
      header: t("blog.col.seo"),
      hide: "lg",
      cell: (p) =>
        p.metaDescription?.trim() ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--ok)]">
            {t("blog.seo.ok")}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2.5 6.5L5 9l4.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : (
          <Badge tone="warn" title={t("blog.seo.missingHint")}>
            {t("blog.seo.missing")}
          </Badge>
        ),
    },
    {
      key: "published",
      header: t("blog.col.published"),
      hide: "md",
      cell: (p) => <span className="text-[var(--foreground-muted)]">{p.isPublished ? f.date(p.publishedAt) : "—"}</span>,
    },
  ];

  const previewSlug = form.slug.trim() || slugify(form.title) || t("blog.editor.slugFallback");

  return (
    <div>
      <PageHeader
        title={t("nav.blog")}
        subtitle={
          loading
            ? t("common.loading")
            : loadError
              ? "—"
              : [
                  t("blog.summary.count", { count: posts.length }),
                  t("blog.summary.published", { count: publishedCount }),
                  t("blog.summary.drafts", { count: draftCount }),
                ].join(" · ")
        }
        actions={[
          {
            key: "ai",
            label: t("blog.aiDraft"),
            onClick: openAiModal,
            icon: (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4 6C4 4.9 4.9 4 6 4C7.1 4 8 4.9 8 6C8 7.1 7.1 8 6 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="6" cy="6" r="1" fill="currentColor" />
              </svg>
            ),
          },
        ]}
        primary={{ key: "new", label: t("blog.new"), icon: PLUS, onClick: openAddModal }}
      />

      {/* Search, the state as chips with counts, the count and the sort. */}
      <div className="mb-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("blog.search.placeholder")}
            label={t("blog.search.label")}
          />
          <FilterChips
            label={t("blog.f.status")}
            value={statusFilter}
            options={[
              { value: "", label: t("filter.all"), count: posts.length },
              { value: "published", label: t("blog.chip.published"), count: publishedCount },
              { value: "draft", label: t("blog.chip.drafts"), count: draftCount },
            ]}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
        </div>
        <ActiveFilters
          filters={[]}
          onClearAll={() => setStatusFilter("")}
          count={loading || loadError ? null : t("filter.count", { shown: filteredPosts.length, total: posts.length })}
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
        label={t("nav.blog")}
        rows={filteredPosts}
        rowKey={(p) => p.id}
        columns={columns}
        loading={loading}
        resetKey={[q, statusFilter, sortKey].join("|")}
        // A draft says so; a published post is the usual state and shows its date.
        card={(p) => ({
          thumb: <Thumb src={p.coverImageUrl} fit="cover" size="lg" />,
          title: p.title,
          badge: p.isPublished ? undefined : <Badge dot>{t("blog.status.draft")}</Badge>,
          meta: [p.category || `/${p.slug}`, ...(p.isPublished ? [f.date(p.publishedAt)] : [])].join(" · "),
        })}
        actions={(post) => (
          <>
            <button
              onClick={() => openEditModal(post)}
              className={`${BTN_ICON_SM} max-md:hidden`}
              aria-label={t("blog.row.edit", { name: post.title })}
              title={t("blog.row.edit", { name: post.title })}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M11 2.5L13.5 5 6 12.5l-3 .5.5-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </button>
            <RowMenu size="sm" label={t("menu.moreFor", { name: post.title })} items={rowItems(post)} />
          </>
        )}
        empty={
          loadError ? (
            <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <p className="text-[13px] text-[var(--err)] break-words">{say(loadError)}</p>
              <button onClick={loadPosts} className={btn("secondary")}>
                {t("common.retry")}
              </button>
            </div>
          ) : posts.length > 0 ? (
            <EmptyState
              text={t("blog.empty.filtered")}
              action={
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("");
                  }}
                  className={btn("secondary")}
                >
                  {t("filter.clearFilters")}
                </button>
              }
            />
          ) : (
            <EmptyState
              text={t("blog.empty.none")}
              action={
                <button onClick={openAddModal} className={btn("primary")}>
                  {t("blog.new")}
                </button>
              }
            />
          )
        }
      />

      {/* AI Generate Modal */}
      {showAiModal && (
        <Modal
          onClose={() => setShowAiModal(false)}
          label={t("blog.aiDraft")}
          panelClassName="rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
            <div>
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">{t("blog.aiDraft")}</h2>
              <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                {aiMode === "url" ? t("blog.ai.subtitle.url") : t("blog.ai.subtitle.brief")}
              </p>
            </div>
            {/* Locked while generating, like Cancel: a reply landing after the
                modal closed would overwrite whatever post is open by then. */}
            <button
              onClick={() => setShowAiModal(false)}
              disabled={aiLoading}
              className={BTN_ICON}
              aria-label={t("common.close")}
              title={t("common.close")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            {/* Mode switch — the two modes run different prompts and pick from
                different halves of the taxonomy, so the choice is explicit. It
                holds still while a draft is being written. */}
            <Tabs
              label={t("blog.ai.source")}
              idBase="blog-ai"
              tabs={[
                { key: "url", label: t("blog.ai.fromUrl") },
                { key: "brief", label: t("blog.ai.fromBrief") },
              ]}
              value={aiMode}
              onChange={(m: AiMode) => {
                if (aiLoading) return;
                setAiMode(m);
                setAiError("");
              }}
            />

            <div {...tabPanel("blog-ai", aiMode)}>
              {aiMode === "url" ? (
                <div>
                  <label htmlFor="blog-ai-url" className={FIELD_LABEL}>{t("blog.ai.url")}</label>
                  <input
                    id="blog-ai-url"
                    type="url"
                    value={aiUrl}
                    onChange={(e) => setAiUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
                    placeholder={t("blog.ai.urlPlaceholder")}
                    className={inputCls}
                    autoFocus
                    disabled={aiLoading}
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="blog-ai-brief" className={FIELD_LABEL}>{t("blog.ai.brief")}</label>
                  <textarea
                    id="blog-ai-brief"
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    placeholder={t("blog.ai.briefPlaceholder")}
                    rows={6}
                    maxLength={4000}
                    className={`${inputCls} resize-y leading-relaxed`}
                    autoFocus
                    disabled={aiLoading}
                  />
                  <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">{t("blog.ai.briefHint")}</p>
                </div>
              )}
            </div>

            {aiError && <p role="alert" className="text-xs text-[var(--err)]">{aiError}</p>}
            {aiLoading && (
              <p role="status" className="text-xs text-[var(--foreground-muted)] animate-pulse">
                {aiMode === "url" ? t("blog.ai.working.url") : t("blog.ai.working.brief")}
              </p>
            )}
          </div>
          <div className="px-6 py-4 border-t border-[var(--border)] flex gap-3">
            <button
              onClick={handleAiGenerate}
              disabled={!aiInputReady || aiLoading}
              className={`${btn("primary")} flex-1`}
            >
              {aiLoading ? t("blog.ai.generating") : t("blog.ai.generate")}
            </button>
            <button
              onClick={() => setShowAiModal(false)}
              disabled={aiLoading}
              className={btn("ghost")}
            >
              {t("common.cancel")}
            </button>
          </div>
        </Modal>
      )}

      {/* Post editor */}
      {showModal && (
        <Modal
          onClose={closeModal}
          label={editingId ? t("blog.editor.edit") : t("blog.new")}
          panelClassName="rounded-2xl w-full max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden"
          closeOnScrim={false}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-[var(--border)] shrink-0">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {editingId ? t("blog.editor.edit") : t("blog.new")}
              </h2>
              <p className="text-[12px] text-[var(--foreground-subtle)] mt-1 font-mono break-all">
                {`/blog/${previewSlug}`}
              </p>
            </div>
            <button
              onClick={closeModal}
              className={`${BTN_ICON} shrink-0`}
              aria-label={t("common.close")}
              title={t("common.close")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 3L13 13M13 3L3 13"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {/* Title */}
            <div>
              <label htmlFor="blog-title" className={FIELD_LABEL}>{t("blog.editor.title")} *</label>
              <input
                id="blog-title"
                type="text"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t("blog.editor.titlePlaceholder")}
                className={`${fieldBase} text-base`}
                autoFocus
              />
            </div>

            {/* Cover image + preview */}
            <div>
              <label htmlFor="blog-cover" className={FIELD_LABEL}>{t("blog.editor.cover")}</label>
              <input
                id="blog-cover"
                type="url"
                value={form.coverImageUrl}
                onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))}
                placeholder={t("blog.editor.urlPlaceholder")}
                className={inputCls}
              />
              {form.coverImageUrl && (
                <div className="mt-2 relative w-full max-w-xs aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.coverImageUrl}
                    alt={t("blog.editor.coverAlt")}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Excerpt */}
            <div>
              <label htmlFor="blog-excerpt" className={FIELD_LABEL}>
                {t("blog.editor.excerpt")}
                <span className="text-[var(--foreground-subtle)] font-normal ml-2">
                  {t("blog.editor.excerptHint")}
                </span>
              </label>
              <textarea
                id="blog-excerpt"
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder={t("blog.editor.excerptPlaceholder")}
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>

            {/* Body */}
            <div>
              <label htmlFor="blog-body" className={FIELD_LABEL}>
                {t("blog.editor.body")}
                <span className="text-[var(--foreground-subtle)] font-normal ml-2">
                  {t("blog.editor.bodyHint")}
                </span>
              </label>
              <textarea
                id="blog-body"
                value={form.body}
                onChange={(e) => handleBodyChange(e.target.value)}
                placeholder={t("blog.editor.bodyPlaceholder")}
                rows={14}
                className={`${inputCls} resize-y leading-relaxed`}
              />
              {form.body && (
                <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">
                  {t("blog.editor.readTimeEstimate", { time: estimateReadTime(form.body) })}
                </p>
              )}
            </div>

            {/* Publish toggle — the switch recipe of DESIGN_SYSTEM.md §9 */}
            <div className="flex items-center gap-3 py-1">
              <button
                type="button"
                role="switch"
                aria-checked={form.isPublished}
                aria-label={t("blog.status.published")}
                onClick={() => setForm((f) => ({ ...f, isPublished: !f.isPublished }))}
                className={`relative w-9 h-5 flex-shrink-0 rounded-full transition-colors ${
                  form.isPublished ? "bg-[var(--foreground)]" : "bg-[var(--border-strong)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface)] transition-[left] ${
                    form.isPublished ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
              <div>
                <p className="text-sm text-[var(--foreground)]">
                  {form.isPublished ? t("blog.status.published") : t("blog.status.draft")}
                </p>
                <p className="text-[11px] text-[var(--foreground-muted)]">
                  {form.isPublished ? t("blog.editor.publishedHint") : t("blog.editor.draftHint")}
                </p>
              </div>
            </div>

            {/* ── Advanced section ───────────────────────────────────── */}
            <div className="border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className={`${btn("ghost")} -ml-3`}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden="true"
                  className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                >
                  <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("blog.editor.advanced")}
              </button>
              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label htmlFor="blog-slug" className={FIELD_LABEL}>
                      {t("blog.editor.slug")}
                      <span className="text-[var(--foreground-subtle)] font-normal ml-2">
                        {autoSlug ? t("blog.editor.autoFromTitle") : t("blog.editor.manual")}
                      </span>
                    </label>
                    <input
                      id="blog-slug"
                      type="text"
                      value={form.slug}
                      onChange={(e) => {
                        setAutoSlug(false);
                        setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                      }}
                      placeholder={t("blog.editor.slugPlaceholder")}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label htmlFor="blog-category" className={FIELD_LABEL}>{t("blog.editor.category")}</label>
                    <input
                      id="blog-category"
                      list="blog-categories"
                      type="text"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder={t("blog.editor.categoryPlaceholder")}
                      className={inputCls}
                    />
                    <datalist id="blog-categories">
                      {BLOG_CATEGORIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.blurb}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label htmlFor="blog-read-time" className={FIELD_LABEL}>
                      {t("blog.editor.readTime")}
                      <span className="text-[var(--foreground-subtle)] font-normal ml-2">
                        {autoReadTime ? t("blog.editor.auto") : t("blog.editor.manual")}
                      </span>
                    </label>
                    <input
                      id="blog-read-time"
                      type="text"
                      value={form.readTime}
                      onChange={(e) => {
                        setAutoReadTime(false);
                        setForm((f) => ({ ...f, readTime: e.target.value }));
                      }}
                      placeholder={t("blog.editor.readTimePlaceholder")}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="blog-author" className={FIELD_LABEL}>{t("blog.editor.author")}</label>
                    <input
                      id="blog-author"
                      type="text"
                      value={form.authorName}
                      onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="blog-published-at" className={FIELD_LABEL}>{t("blog.editor.publishDate")}</label>
                    <input
                      id="blog-published-at"
                      type="datetime-local"
                      value={form.publishedAt}
                      onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── SEO section ────────────────────────────────────────── */}
            <div className="border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setShowSeo((v) => !v)}
                aria-expanded={showSeo}
                className={`${btn("ghost")} -ml-3`}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden="true"
                  className={`transition-transform ${showSeo ? "rotate-90" : ""}`}
                >
                  <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("blog.editor.seo")}
                <span className="text-[var(--foreground-subtle)] font-normal">
                  {t("blog.editor.optional")}
                </span>
              </button>
              {showSeo && (
                <div className="mt-4 flex flex-col gap-3">
                  <div>
                    <label htmlFor="blog-meta-title" className={FIELD_LABEL}>{t("blog.editor.metaTitle")}</label>
                    <input
                      id="blog-meta-title"
                      type="text"
                      value={form.metaTitle}
                      onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
                      placeholder={t("blog.editor.metaTitlePlaceholder", {
                        title: form.title || t("blog.editor.titlePlaceholder"),
                      })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="blog-meta-description" className={FIELD_LABEL}>{t("blog.editor.metaDescription")}</label>
                    <textarea
                      id="blog-meta-description"
                      value={form.metaDescription}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, metaDescription: e.target.value }))
                      }
                      placeholder={t("blog.editor.metaDescriptionPlaceholder")}
                      rows={2}
                      className={`${inputCls} resize-y`}
                    />
                    <p className="mt-1 text-[12px] text-[var(--foreground-subtle)] tabular-nums">
                      {(form.metaDescription || form.excerpt).length} / 160
                    </p>
                  </div>
                  <div>
                    <label htmlFor="blog-og-image" className={FIELD_LABEL}>{t("blog.editor.ogImage")}</label>
                    <input
                      id="blog-og-image"
                      type="url"
                      value={form.ogImage}
                      onChange={(e) => setForm((f) => ({ ...f, ogImage: e.target.value }))}
                      placeholder={t("blog.editor.ogImagePlaceholder")}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>

            {saveError && (
              <p role="alert" className="text-xs text-[var(--err)]">{saveError}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--border)] flex gap-3 shrink-0">
            <button
              onClick={handleSave}
              disabled={!form.title.trim() || saving}
              className={`${btn("primary")} flex-1`}
            >
              {saving
                ? t("common.saving")
                : editingId
                ? t("blog.editor.saveChanges")
                : form.isPublished
                ? t("blog.editor.publish")
                : t("blog.editor.saveDraft")}
            </button>
            <button
              onClick={closeModal}
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
