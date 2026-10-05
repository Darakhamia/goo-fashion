"use client";

import { useState, useEffect, useCallback } from "react";
import type { BlogPost } from "@/lib/types";
import { estimateReadTime, slugify } from "@/lib/blog-render";
import { BLOG_CATEGORIES } from "@/lib/blog-categories";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { btn, BTN_ICON, BTN_ICON_SM } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT } from "@/app/goo-studio/_i18n";
import type { Key } from "@/app/goo-studio/_i18n";
import { DataTable, EmptyState, Thumb } from "@/components/admin/DataTable";
import type { Column } from "@/components/admin/DataTable";
import { ActiveFilters, FilterChips, FilterMenu, SearchField } from "@/components/admin/FilterBar";
import { RowMenu } from "@/components/admin/Menu";
import type { MenuItem } from "@/components/admin/Menu";
import { Badge } from "@/components/admin/Badge";
import { Modal } from "@/components/admin/Modal";

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
const labelCls =
  "block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5";

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
  const [loadError, setLoadError] = useState("");

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
    setLoadError("");
    fetch("/api/blog")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          setLoadError(data?.error ?? `Could not load posts (HTTP ${r.status}).`);
          return;
        }
        // A 200 that is not a list (e.g. an expired session answered with the
        // sign-in page) is a failed load too, not an empty blog.
        if (!Array.isArray(data)) {
          setLoadError("Could not load posts: unexpected response. Reload the page.");
          return;
        }
        setPosts(data);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Network error."))
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
      setSaveError("Title is required.");
      return;
    }
    const finalSlug = form.slug.trim() || slugify(form.title);
    if (!finalSlug) {
      setSaveError("Could not generate a URL slug — edit it manually.");
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
        setSaveError(err.error ?? "Failed to save.");
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
      setSaveError(e instanceof Error ? e.message : "Network error.");
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
        setAiError(data.error ?? "Generation failed.");
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
      setAiError(e instanceof Error ? e.message : "Network error.");
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

  const previewSlug = form.slug.trim() || slugify(form.title) || "your-post-slug";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">{t("nav.blog")}</h1>
          <p className="text-[13px] text-[var(--foreground-muted)] mt-1">
            {loading
              ? t("common.loading")
              : loadError
                ? "—"
                : [
                    t("blog.summary.count", { count: posts.length }),
                    t("blog.summary.published", { count: publishedCount }),
                    t("blog.summary.drafts", { count: draftCount }),
                  ].join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAiModal} className={btn("secondary")}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 6C4 4.9 4.9 4 6 4C7.1 4 8 4.9 8 6C8 7.1 7.1 8 6 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="6" cy="6" r="1" fill="currentColor" />
            </svg>
            {t("blog.aiDraft")}
          </button>
          <button onClick={openAddModal} className={btn("primary")}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {t("blog.new")}
          </button>
        </div>
      </div>

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
              <p className="text-[13px] text-[var(--err)] break-words">{loadError}</p>
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
          label="AI Draft"
          panelClassName="rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
            <div>
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">AI Draft</h2>
              <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                {aiMode === "url"
                  ? "Rewrite an article, brand page or collection"
                  : "Announce a release in GOO's own name"}
              </p>
            </div>
            {/* Locked while generating, like Cancel: a reply landing after the
                modal closed would overwrite whatever post is open by then. */}
            <button
              onClick={() => setShowAiModal(false)}
              disabled={aiLoading}
              className={BTN_ICON}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            {/* Mode switch — the two modes run different prompts and pick from
                different halves of the taxonomy, so the choice is explicit. */}
            <div
              role="tablist"
              aria-label="Draft source"
              className="flex gap-0 bg-[var(--background)] rounded-full p-1 border border-[var(--border)] w-fit"
            >
              {([
                { id: "url" as const, label: "From URL" },
                { id: "brief" as const, label: "From brief" },
              ]).map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={aiMode === m.id}
                  onClick={() => { setAiMode(m.id); setAiError(""); }}
                  disabled={aiLoading}
                  className="px-5 py-2 text-[13px] font-medium rounded-full transition-colors duration-200 disabled:opacity-40"
                  style={
                    aiMode === m.id
                      ? { background: "var(--foreground)", color: "var(--surface)" }
                      : { color: "var(--foreground-muted)" }
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>

            {aiMode === "url" ? (
              <div>
                <label className={labelCls}>URL</label>
                <input
                  type="url"
                  value={aiUrl}
                  onChange={(e) => setAiUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
                  placeholder="https://vogue.com/article/..."
                  className={inputCls}
                  autoFocus
                  disabled={aiLoading}
                />
              </div>
            ) : (
              <div>
                <label className={labelCls}>Brief</label>
                <textarea
                  value={aiBrief}
                  onChange={(e) => setAiBrief(e.target.value)}
                  placeholder={"Shipped the new outfit builder: drag and drop, up to 6 items per look, saves to your profile.\n\nWorks on mobile now."}
                  rows={6}
                  maxLength={4000}
                  className={`${inputCls} resize-y leading-relaxed`}
                  autoFocus
                  disabled={aiLoading}
                />
                <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">
                  A few lines is enough. The post can only claim what you write here — nothing is invented.
                </p>
              </div>
            )}

            {aiError && <p className="text-xs text-[var(--err)]">{aiError}</p>}
            {aiLoading && (
              <p className="text-xs text-[var(--foreground-muted)] animate-pulse">
                {aiMode === "url"
                  ? "Reading article and writing post — this takes about 10 seconds..."
                  : "Writing the post — this takes about 10 seconds..."}
              </p>
            )}
          </div>
          <div className="px-6 py-4 border-t border-[var(--border)] flex gap-3">
            <button
              onClick={handleAiGenerate}
              disabled={!aiInputReady || aiLoading}
              className={`${btn("primary")} flex-1`}
            >
              {aiLoading ? "Generating..." : "Generate post"}
            </button>
            <button
              onClick={() => setShowAiModal(false)}
              disabled={aiLoading}
              className={btn("ghost")}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Modal */}
      {showModal && (
        <Modal
          onClose={closeModal}
          label={editingId ? "Edit Post" : "New Post"}
          panelClassName="rounded-2xl w-full max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden"
          closeOnScrim={false}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-[var(--border)] shrink-0">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {editingId ? "Edit Post" : "New Post"}
              </h2>
              <p className="text-[12px] text-[var(--foreground-subtle)] mt-1 font-mono break-all">
                /blog/{previewSlug}
              </p>
            </div>
            <button
              onClick={closeModal}
              className={`${BTN_ICON} shrink-0`}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
              <label className={labelCls}>Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Post title"
                className={`${fieldBase} text-base`}
                autoFocus
              />
            </div>

            {/* Cover image + preview */}
            <div>
              <label className={labelCls}>Cover image URL</label>
              <input
                type="url"
                value={form.coverImageUrl}
                onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))}
                placeholder="https://..."
                className={inputCls}
              />
              {form.coverImageUrl && (
                <div className="mt-2 relative w-full max-w-xs aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Excerpt */}
            <div>
              <label className={labelCls}>
                Excerpt
                <span className="text-[var(--foreground-subtle)] font-normal ml-2">
                  (short summary)
                </span>
              </label>
              <textarea
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder="One or two sentences describing the post."
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>

            {/* Body */}
            <div>
              <label className={labelCls}>
                Article body
                <span className="text-[var(--foreground-subtle)] font-normal ml-2">
                  — plain text works. HTML is supported too.
                </span>
              </label>
              <textarea
                value={form.body}
                onChange={(e) => handleBodyChange(e.target.value)}
                placeholder={
                  "Write your article here.\n\nLeave a blank line between paragraphs.\n\nFor headings or links, use HTML: <h2>Heading</h2> or <a href=\"...\">link</a>."
                }
                rows={14}
                className={`${inputCls} resize-y leading-relaxed`}
              />
              {form.body && (
                <p className="mt-1.5 text-[12px] text-[var(--foreground-subtle)]">
                  ≈ {estimateReadTime(form.body)} read
                </p>
              )}
            </div>

            {/* Publish toggle */}
            <div className="flex items-center gap-3 py-1">
              <button
                type="button"
                role="switch"
                aria-checked={form.isPublished}
                aria-label="Published"
                onClick={() => setForm((f) => ({ ...f, isPublished: !f.isPublished }))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  form.isPublished ? "bg-[var(--foreground)]" : "bg-[var(--border-strong)]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-[var(--surface)] transition-transform ${
                    form.isPublished ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <div>
                <p className="text-sm text-[var(--foreground)]">
                  {form.isPublished ? "Published" : "Draft"}
                </p>
                <p className="text-[11px] text-[var(--foreground-muted)]">
                  {form.isPublished
                    ? "Visible to everyone on /blog."
                    : "Hidden from the public site."}
                </p>
              </div>
            </div>

            {/* ── Advanced section ───────────────────────────────────── */}
            <div className="border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-2 text-[13px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                >
                  <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Advanced options
              </button>
              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className={labelCls}>
                      Slug
                      <span className="text-[var(--foreground-subtle)] font-normal ml-2">
                        {autoSlug ? "(auto from title)" : "(manual)"}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => {
                        setAutoSlug(false);
                        setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                      }}
                      placeholder="post-slug"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <input
                      list="blog-categories"
                      type="text"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Style Guide"
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
                    <label className={labelCls}>
                      Read time
                      <span className="text-[var(--foreground-subtle)] font-normal ml-2">
                        {autoReadTime ? "(auto)" : "(manual)"}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={form.readTime}
                      onChange={(e) => {
                        setAutoReadTime(false);
                        setForm((f) => ({ ...f, readTime: e.target.value }));
                      }}
                      placeholder="5 min"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Author</label>
                    <input
                      type="text"
                      value={form.authorName}
                      onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Publish date override</label>
                    <input
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
                className="flex items-center gap-2 text-[13px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={`transition-transform ${showSeo ? "rotate-90" : ""}`}
                >
                  <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                SEO overrides
                <span className="text-[var(--foreground-subtle)] font-normal ml-1">
                  (optional)
                </span>
              </button>
              {showSeo && (
                <div className="mt-4 flex flex-col gap-3">
                  <div>
                    <label className={labelCls}>Meta title</label>
                    <input
                      type="text"
                      value={form.metaTitle}
                      onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
                      placeholder={`${form.title || "Post title"} — GOO Journal`}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Meta description</label>
                    <textarea
                      value={form.metaDescription}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, metaDescription: e.target.value }))
                      }
                      placeholder="Defaults to excerpt. Keep under 160 characters."
                      rows={2}
                      className={`${inputCls} resize-y`}
                    />
                    <p className="mt-1 text-[12px] text-[var(--foreground-subtle)]">
                      {(form.metaDescription || form.excerpt).length} / 160
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Open Graph image URL</label>
                    <input
                      type="url"
                      value={form.ogImage}
                      onChange={(e) => setForm((f) => ({ ...f, ogImage: e.target.value }))}
                      placeholder="Defaults to cover image."
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>

            {saveError && (
              <p className="text-xs text-[var(--err)]">{saveError}</p>
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
                ? "Saving..."
                : editingId
                ? "Save changes"
                : form.isPublished
                ? "Publish post"
                : "Save draft"}
            </button>
            <button
              onClick={closeModal}
              className={btn("ghost")}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
