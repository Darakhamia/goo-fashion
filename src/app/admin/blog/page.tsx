"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { BlogPost } from "@/lib/types";
import { estimateReadTime } from "@/lib/blog-render";

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

const COMMON_CATEGORIES = [
  "AI Stylist",
  "Style Guide",
  "Smart Shopping",
  "Brands",
  "Trends",
  "How-to",
  "News",
];

const inputCls =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";
const labelCls =
  "block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogFormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [autoSlug, setAutoSlug] = useState(true);
  const [autoReadTime, setAutoReadTime] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSeo, setShowSeo] = useState(false);

  useEffect(() => {
    fetch("/api/blog?all=true")
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

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
      publishedAt: post.publishedAt
        ? new Date(post.publishedAt).toISOString().slice(0, 16)
        : "",
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

    const body = {
      ...form,
      slug: finalSlug,
      publishedAt: form.publishedAt
        ? new Date(form.publishedAt).toISOString()
        : undefined,
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      const res = await fetch(`/api/blog/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      }
    } finally {
      setDeleteId(null);
    }
  };

  const filteredPosts = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const previewSlug = form.slug.trim() || slugify(form.title) || "your-post-slug";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">
            Blog
          </h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
            {loading
              ? "Loading..."
              : `${posts.length} posts · ${filteredPosts.length} shown`}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 text-xs tracking-[0.12em] uppercase transition-opacity hover:opacity-80"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1V11M1 6H11"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          New Post
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="search"
          placeholder="Search by title, slug, category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputCls} max-w-sm`}
        />
      </div>

      {/* Table */}
      <div
        className="border border-[var(--border)] overflow-x-auto"
        style={{ background: "var(--background)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Cover", "Title", "Slug", "Category", "Status", "Published", "Actions"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal${
                      i === 6 ? " text-right" : ""
                    }${i >= 3 && i <= 5 ? " hidden lg:table-cell" : ""}${
                      i === 2 ? " hidden md:table-cell" : ""
                    }`}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]"
                >
                  Loading...
                </td>
              </tr>
            ) : filteredPosts.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]"
                >
                  No posts yet. Click &quot;New Post&quot; to create one.
                </td>
              </tr>
            ) : (
              filteredPosts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="relative w-12 h-12 overflow-hidden flex-shrink-0 bg-[var(--surface)]">
                      {post.coverImageUrl && (
                        <Image
                          src={post.coverImageUrl}
                          alt={post.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">
                      {post.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-[11px] text-[var(--foreground-muted)]">
                      /{post.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {post.category ? (
                      <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] border border-[var(--border)] px-2 py-0.5">
                        {post.category}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--foreground-subtle)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span
                      className={`text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 border ${
                        post.isPublished
                          ? "text-[var(--foreground)] border-[var(--foreground)]"
                          : "text-[var(--foreground-subtle)] border-[var(--border)]"
                      }`}
                    >
                      {post.isPublished ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-[var(--foreground-muted)]">
                      {formatDate(post.publishedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1"
                        aria-label="View"
                        title="Open public page"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                      </a>
                      <button
                        onClick={() => openEditModal(post)}
                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1"
                        aria-label="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={deleteId === post.id}
                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1 disabled:opacity-40"
                        aria-label="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-6 px-4">
          <div
            className="border border-[var(--border)] w-full max-w-3xl flex flex-col"
            style={{ background: "var(--background)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <div>
                <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                  {editingId ? "Edit Post" : "New Post"}
                </h2>
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mt-1 font-mono">
                  /blog/{previewSlug}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
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
            <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto" style={{ maxHeight: "75vh" }}>
              {/* Title */}
              <div>
                <label className={labelCls}>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Post title"
                  className={`${inputCls} text-base`}
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
                  <div className="mt-2 relative w-full max-w-xs aspect-[4/3] overflow-hidden border border-[var(--border)]">
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
                  <span className="text-[var(--foreground-subtle)] normal-case ml-2">
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
                  <span className="text-[var(--foreground-subtle)] normal-case ml-2">
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
                  className={`${inputCls} resize-y text-sm leading-relaxed`}
                />
                {form.body && (
                  <p className="mt-1.5 text-[10px] text-[var(--foreground-subtle)]">
                    ≈ {estimateReadTime(form.body)} read
                  </p>
                )}
              </div>

              {/* Publish toggle */}
              <div className="flex items-center gap-3 py-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isPublished: !f.isPublished }))}
                  className={`relative inline-flex h-6 w-11 items-center transition-colors ${
                    form.isPublished ? "bg-[var(--foreground)]" : "bg-[var(--border)]"
                  }`}
                  aria-pressed={form.isPublished}
                >
                  <span
                    className={`inline-block h-4 w-4 transform bg-[var(--background)] transition-transform ${
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
                  className="flex items-center gap-2 text-[10px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
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
                        <span className="text-[var(--foreground-subtle)] normal-case ml-2">
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
                        {COMMON_CATEGORIES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className={labelCls}>
                        Read time
                        <span className="text-[var(--foreground-subtle)] normal-case ml-2">
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
                  className="flex items-center gap-2 text-[10px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
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
                  <span className="text-[var(--foreground-subtle)] normal-case font-sans tracking-normal ml-1">
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
                      <p className="mt-1 text-[10px] text-[var(--foreground-subtle)]">
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
                <p className="text-xs text-red-500">{saveError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] flex gap-3">
              <button
                onClick={handleSave}
                disabled={!form.title.trim() || saving}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-3 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="border border-[var(--border)] px-5 py-3 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
