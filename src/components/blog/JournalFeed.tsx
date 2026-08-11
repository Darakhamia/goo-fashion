"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "@/components/ui/Image";
import type { BlogPost } from "@/lib/types";
import { blogCategoryRank } from "@/lib/blog-categories";

/**
 * The Journal's feed and its filters.
 *
 * Filters are derived from the posts that exist, never from a hardcoded list:
 * `category` on `blog_posts` is free text, so a post tagged under an older
 * taxonomy would otherwise be filterable by nothing at all. Known categories
 * sort first (see `blogCategoryRank`), leftovers follow, and a category with no
 * posts never gets a chip.
 *
 * The active filter lives in the URL so a link can point at one — "here are our
 * announcements" — but it is written with `history.replaceState` rather than
 * `useSearchParams`. Reading search params in a client component would opt the
 * whole statically-rendered page into client rendering, and seeding state from
 * them would render "All" on the server and something else on the client, which
 * is exactly the hydration mismatch class the site is already fighting.
 */

type Props = { posts: BlogPost[] };

const ALL = "All";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function yearOf(iso: string): string {
  const y = new Date(iso).getFullYear();
  return Number.isFinite(y) ? String(y) : "";
}

/**
 * The filter in the URL, read as an external store rather than copied into state
 * by a mount effect. The server snapshot is "no filter", the client snapshot is
 * whatever the address bar says — which is how the two are allowed to differ
 * without a hydration mismatch. A plain string keeps the snapshot referentially
 * stable, so React has nothing to re-read on every render.
 */
const noopSubscribe = () => () => {};
/** JSON rather than a delimiter: category names contain spaces, so any
 *  separator cheap enough to type is one a category could also contain. */
const readUrlFilter = () => {
  const p = new URLSearchParams(window.location.search);
  return JSON.stringify([p.get("category") ?? ALL, p.get("year") ?? ALL]);
};
const noUrlFilter = () => JSON.stringify([ALL, ALL]);

const chipCls = (active: boolean) =>
  `shrink-0 px-4 py-2 rounded-full border text-[11px] tracking-[0.12em] uppercase font-medium transition-all duration-200 ${
    active
      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
      : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
  }`;

export default function JournalFeed({ posts }: Props) {
  // The URL seeds the filter; once the reader touches a chip their pick takes
  // over and the URL becomes an output rather than an input.
  const fromUrl = useSyncExternalStore(noopSubscribe, readUrlFilter, noUrlFilter);
  const [picked, setPicked] = useState<{ category: string; year: string } | null>(null);

  const [urlCategory, urlYear] = JSON.parse(fromUrl) as [string, string];
  const category = picked?.category ?? urlCategory;
  const year = picked?.year ?? urlYear;

  const syncUrl = useCallback((nextCategory: string, nextYear: string) => {
    const params = new URLSearchParams(window.location.search);
    if (nextCategory === ALL) params.delete("category");
    else params.set("category", nextCategory);
    if (nextYear === ALL) params.delete("year");
    else params.set("year", nextYear);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  const pickCategory = (next: string) => {
    setPicked({ category: next, year });
    syncUrl(next, year);
  };
  const pickYear = (next: string) => {
    setPicked({ category, year: next });
    syncUrl(category, next);
  };
  const clearFilters = () => {
    setPicked({ category: ALL, year: ALL });
    syncUrl(ALL, ALL);
  };

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      const c = p.category?.trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => blogCategoryRank(a[0]) - blogCategoryRank(b[0]) || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [posts]);

  const years = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      const y = yearOf(p.publishedAt);
      if (y) counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([name, count]) => ({ name, count }));
  }, [posts]);

  const filtered = useMemo(
    () =>
      posts.filter(
        (p) =>
          (category === ALL || p.category === category) &&
          (year === ALL || yearOf(p.publishedAt) === year)
      ),
    [posts, category, year]
  );

  const isFiltered = category !== ALL || year !== ALL;
  // The featured slot is the Journal's front door. Once a filter is on, the set
  // is a result list — a uniform grid reads better than one giant card plus two.
  const featured = isFiltered ? null : filtered[0];
  const rest = featured ? filtered.slice(1) : filtered;

  return (
    <>
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--border)] pt-6 mb-10 md:mb-14">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => pickCategory(ALL)} className={chipCls(category === ALL)}>
            All
            <span className="ml-2 opacity-50">{posts.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              onClick={() => pickCategory(c.name)}
              className={chipCls(category === c.name)}
            >
              {c.name}
              <span className="ml-2 opacity-50">{c.count}</span>
            </button>
          ))}
        </div>

        {/* A single year is not a filter, it is a fact — only offer the row
            once there is something to choose between. */}
        {years.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mr-1">
              Year
            </span>
            <button onClick={() => pickYear(ALL)} className={chipCls(year === ALL)}>
              All
            </button>
            {years.map((y) => (
              <button key={y.name} onClick={() => pickYear(y.name)} className={chipCls(year === y.name)}>
                {y.name}
                <span className="ml-2 opacity-50">{y.count}</span>
              </button>
            ))}
          </div>
        )}

        {isFiltered && (
          <p className="mt-4 text-[11px] text-[var(--foreground-muted)]">
            {filtered.length} {filtered.length === 1 ? "post" : "posts"}
            <button
              onClick={clearFilters}
              className="ml-3 text-[var(--foreground)] link-underline"
            >
              Clear filters
            </button>
          </p>
        )}
      </div>

      {/* ── Featured ─────────────────────────────────────────────────────── */}
      {featured && (
        <Link href={`/blog/${featured.slug}`} className="group block mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-colors duration-200">
            <div className="img-zoom relative aspect-[4/3] overflow-hidden">
              <Image
                src={featured.coverImageUrl}
                alt={featured.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="p-8 md:p-12 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[10px] tracking-[0.16em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] px-3 py-1.5 rounded-full">
                    {featured.category}
                  </span>
                  <span className="text-[10px] text-[var(--foreground-subtle)]">
                    {featured.readTime} read
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] leading-snug mb-4 group-hover:opacity-70 transition-opacity duration-200">
                  {featured.title}
                </h2>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                  {featured.excerpt}
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <span className="text-xs text-[var(--foreground-subtle)]">
                  {formatDate(featured.publishedAt)}
                </span>
                <span className="text-[11px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] group-hover:text-[var(--foreground)] transition-colors duration-200">
                  Read →
                </span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--border-strong)] transition-colors duration-200"
            >
              <div className="img-zoom relative aspect-[3/2] overflow-hidden">
                <Image
                  src={post.coverImageUrl}
                  alt={post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)]">
                    {post.category}
                  </span>
                  <span className="w-px h-3 bg-[var(--border-strong)]" />
                  <span className="text-[10px] text-[var(--foreground-subtle)]">
                    {post.readTime} read
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold text-[var(--foreground)] leading-snug mb-2 group-hover:opacity-70 transition-opacity duration-200">
                  {post.title}
                </h3>
                <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed flex-1">
                  {post.excerpt}
                </p>
                <p className="mt-4 text-[10px] text-[var(--foreground-subtle)]">
                  {formatDate(post.publishedAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-24 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
          <p className="text-xl font-semibold text-[var(--foreground)] mb-2">Nothing here yet</p>
          <p className="text-sm text-[var(--foreground-muted)] mb-4">
            No posts match this combination of filters.
          </p>
          <button onClick={clearFilters} className="text-xs text-[var(--foreground)] link-underline">
            Clear all filters
          </button>
        </div>
      )}
    </>
  );
}
