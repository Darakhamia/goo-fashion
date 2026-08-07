"use client";

/**
 * Categories — the editor for the catalog's filter tree.
 *
 * The tree used to be hardcoded, so a new subcategory meant a code change.
 * Here a group holds subcategories, and each subcategory points at one of the
 * fixed category values a product can store. Picking "Sneakers" in the product
 * editor writes both: `subcategory = 'Sneakers'`, `category = 'footwear'`.
 *
 * Every edit carries its products. Renaming a subcategory renames it on the
 * pieces filed under it, re-pointing it moves them to the new bucket, and
 * deleting it clears the label so they fall back to answering their whole
 * group. The counts next to each label are what those edits would touch.
 */

import { useCallback, useEffect, useState } from "react";
import { CATEGORY_VALUES, type CategoryGroup } from "@/lib/categories";
import { invalidateCategoryTree } from "@/lib/hooks/useCategoryTree";

const MIGRATION_SQL = `-- supabase/migrations/011_category_tree.sql
create table if not exists public.category_groups (
  id text primary key, label text not null, sort_order int not null default 0
);
create table if not exists public.category_subcategories (
  id serial primary key,
  group_id text not null references public.category_groups (id) on delete cascade,
  label text not null, value text not null, sort_order int not null default 0,
  unique (label)
);
alter table public.category_groups        enable row level security;
alter table public.category_subcategories enable row level security;
drop policy if exists "Public read access" on public.category_groups;
create policy "Public read access" on public.category_groups for select using (true);
drop policy if exists "Public read access" on public.category_subcategories;
create policy "Public read access" on public.category_subcategories for select using (true);
notify pgrst, 'reload schema';

-- Then run the seed block at the bottom of the migration file to load the
-- current tree, or add the groups by hand here once the tables exist.`;

interface Counts {
  byLabel: Record<string, number>;
  unassignedByCategory: Record<string, number>;
}

interface TreeResponse {
  groups: CategoryGroup[];
  source: "db" | "default";
  reason?: string;
  counts?: Counts;
}

const inputCls =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";
const btnCls =
  "shrink-0 border border-[var(--foreground)] text-[var(--foreground)] px-4 py-2 text-[11px] tracking-[0.12em] uppercase hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const ghostBtnCls =
  "text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40";

export default function AdminCategoriesPage() {
  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [showSql, setShowSql] = useState(false);

  /** Which row is open for editing: `sub:12` or `group:footwear`. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftValue, setDraftValue] = useState("");

  /** The "add subcategory" row, keyed by the group it sits under. */
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newGroupLabel, setNewGroupLabel] = useState("");

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories?counts=1");
      setTree(await res.json());
    } catch {
      setTree(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Every write goes through here so the storefront's cached tree is dropped. */
  const send = async (init: RequestInit & { url?: string }): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    try {
      const res = await fetch(init.url ?? "/api/categories", init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(String(json.error ?? "Something went wrong."), "err");
        return null;
      }
      invalidateCategoryTree();
      await load();
      return json;
    } catch {
      showToast("Network error.", "err");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const post = (body: Record<string, unknown>) =>
    send({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const patch = (body: Record<string, unknown>) =>
    send({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const tableMissing = tree?.source === "default" && tree?.reason === "tables-missing";
  const noDatabase = tree?.source === "default" && tree?.reason === "no-database";
  const readOnly = tree?.source !== "db";
  const counts = tree?.counts;

  /* ── Subcategory actions ── */

  const startEditSub = (id: number, label: string, value: string) => {
    setEditing(`sub:${id}`);
    setDraftLabel(label);
    setDraftValue(value);
  };

  const saveSub = async (id: number, before: { label: string; value: string }) => {
    const body: Record<string, unknown> = { kind: "subcategory", id };
    if (draftLabel.trim() && draftLabel.trim() !== before.label) body.label = draftLabel.trim();
    if (draftValue && draftValue !== before.value) body.value = draftValue;
    if (Object.keys(body).length === 2) {
      setEditing(null);
      return;
    }
    const json = await patch(body);
    if (json) {
      const moved = Number(json.productsUpdated ?? 0);
      showToast(moved ? `Saved — ${moved} product${moved === 1 ? "" : "s"} updated.` : "Saved.");
      setEditing(null);
    }
  };

  const deleteSub = async (id: number, label: string) => {
    const n = counts?.byLabel[label] ?? 0;
    const warning = n
      ? `Delete "${label}"?\n\n${n} product${n === 1 ? "" : "s"} carr${n === 1 ? "ies" : "y"} this label. They keep their category and stay in the catalog, but lose the label and answer to their whole group again.`
      : `Delete "${label}"?`;
    if (!confirm(warning)) return;
    const json = await send({ url: `/api/categories?kind=subcategory&id=${id}`, method: "DELETE" });
    if (json) {
      const cleared = Number(json.productsUpdated ?? 0);
      showToast(cleared ? `Deleted — ${cleared} product${cleared === 1 ? "" : "s"} cleared.` : "Deleted.");
    }
  };

  /** Swaps a subcategory with its neighbour by rewriting both sort orders. */
  const moveSub = async (group: CategoryGroup, index: number, delta: number) => {
    const items = group.items;
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    if (a.id === undefined || b.id === undefined) return;
    setBusy(true);
    await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "subcategory", id: a.id, sortOrder: target + 1 }),
    });
    await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "subcategory", id: b.id, sortOrder: index + 1 }),
    });
    invalidateCategoryTree();
    await load();
    setBusy(false);
  };

  const addSub = async (groupId: string) => {
    const label = newLabel.trim();
    if (!label || !newValue) return;
    const group = tree?.groups.find((g) => g.id === groupId);
    const json = await post({
      kind: "subcategory",
      groupId,
      label,
      value: newValue,
      sortOrder: (group?.items.length ?? 0) + 1,
    });
    if (json) {
      showToast(`"${label}" added.`);
      setNewLabel("");
      setAddingIn(null);
    }
  };

  /* ── Group actions ── */

  const addGroup = async () => {
    const label = newGroupLabel.trim();
    if (!label) return;
    const json = await post({
      kind: "group",
      label,
      sortOrder: (tree?.groups.length ?? 0) + 1,
    });
    if (json) {
      showToast(`"${label}" added.`);
      setNewGroupLabel("");
    }
  };

  const saveGroup = async (id: string, before: string) => {
    const label = draftLabel.trim();
    if (!label || label === before) {
      setEditing(null);
      return;
    }
    const json = await patch({ kind: "group", id, label });
    if (json) {
      showToast("Saved.");
      setEditing(null);
    }
  };

  const deleteGroup = async (id: string, label: string) => {
    if (!confirm(`Delete the "${label}" group?`)) return;
    const json = await send({ url: `/api/categories?kind=group&id=${encodeURIComponent(id)}`, method: "DELETE" });
    if (json) showToast("Group deleted.");
  };

  /* ── Render ── */

  const groups = tree?.groups ?? [];
  const totalSubs = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Categories</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
          {groups.length} group{groups.length === 1 ? "" : "s"} · {totalSubs} subcategor
          {totalSubs === 1 ? "y" : "ies"} · drives the catalog filters, the product editor and breadcrumbs
        </p>
      </div>

      {noDatabase && (
        <div className="mb-6 border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-600">
          Supabase is not configured — this is the built-in tree, and it can&apos;t be edited from here.
        </div>
      )}

      {tableMissing && (
        <div className="mb-6 border border-amber-500/30 bg-amber-500/5 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-amber-700 mb-1">Category tables not found</p>
              <p className="text-[11px] text-amber-600 leading-relaxed">
                You&apos;re looking at the tree hardcoded in the app, which is read-only. Run{" "}
                <span className="font-mono">supabase/migrations/011_category_tree.sql</span> to move it
                into the database and make it editable here.
              </p>
            </div>
            <button onClick={() => setShowSql((v) => !v)} className="shrink-0 text-[10px] tracking-[0.1em] uppercase font-medium border border-amber-500/40 text-amber-700 px-3 py-1.5 hover:bg-amber-500/10 transition-colors">
              {showSql ? "Hide SQL" : "Show SQL"}
            </button>
          </div>
          {showSql && (
            <pre className="mt-3 text-[10px] font-mono text-amber-800 bg-amber-500/10 border border-amber-500/20 p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {MIGRATION_SQL}
            </pre>
          )}
        </div>
      )}

      {loading ? (
        <div className="px-6 py-12 text-center text-xs text-[var(--foreground-muted)] tracking-wide">Loading…</div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const items = group.items;
            // A group's buckets are the distinct values its labels point at;
            // whatever sits in one without a label of its own is unsorted.
            const unassigned = [...new Set(items.map((i) => i.value))].reduce(
              (n, v) => n + (counts?.unassignedByCategory[v] ?? 0),
              0,
            );

            return (
              <section key={group.id} className="rounded-xl border border-[var(--border)]" style={{ background: "var(--background)" }}>
                <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--border)]">
                  {editing === `group:${group.id}` ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        autoFocus
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveGroup(group.id, group.label);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className={`${inputCls} flex-1`}
                      />
                      <button onClick={() => saveGroup(group.id, group.label)} disabled={busy} className={btnCls}>Save</button>
                      <button onClick={() => setEditing(null)} className={ghostBtnCls}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <h2 className="text-sm text-[var(--foreground)]">{group.label}</h2>
                        <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5 font-mono">
                          ?category={group.id}
                          {unassigned > 0 && (
                            <span className="ml-2 font-sans text-amber-600">
                              {unassigned} piece{unassigned === 1 ? "" : "s"} with no subcategory
                            </span>
                          )}
                        </p>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-3 shrink-0">
                          <button onClick={() => { setEditing(`group:${group.id}`); setDraftLabel(group.label); }} className={ghostBtnCls}>Rename</button>
                          <button onClick={() => deleteGroup(group.id, group.label)} disabled={busy} className={ghostBtnCls}>Delete</button>
                        </div>
                      )}
                    </>
                  )}
                </header>

                <ul>
                  {items.map((item, i) => {
                    const n = counts?.byLabel[item.label] ?? 0;
                    const isEditing = item.id !== undefined && editing === `sub:${item.id}`;
                    return (
                      <li key={item.label} className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 flex-wrap">
                            <input
                              autoFocus
                              value={draftLabel}
                              onChange={(e) => setDraftLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveSub(item.id!, { label: item.label, value: item.value });
                                if (e.key === "Escape") setEditing(null);
                              }}
                              className={`${inputCls} flex-1 min-w-[160px]`}
                            />
                            <select value={draftValue} onChange={(e) => setDraftValue(e.target.value)} className={inputCls}>
                              {CATEGORY_VALUES.map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                            <button onClick={() => saveSub(item.id!, { label: item.label, value: item.value })} disabled={busy} className={btnCls}>Save</button>
                            <button onClick={() => setEditing(null)} className={ghostBtnCls}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm text-[var(--foreground)] flex-1 min-w-0 truncate">{item.label}</span>
                            <span className="text-[10px] font-mono text-[var(--foreground-subtle)] shrink-0">{item.value}</span>
                            <span className="text-[10px] text-[var(--foreground-muted)] tabular-nums w-16 text-right shrink-0">
                              {n} piece{n === 1 ? "" : "s"}
                            </span>
                            {!readOnly && item.id !== undefined && (
                              <div className="flex items-center gap-2.5 shrink-0">
                                <button onClick={() => moveSub(group, i, -1)} disabled={busy || i === 0} title="Move up" className={ghostBtnCls}>↑</button>
                                <button onClick={() => moveSub(group, i, 1)} disabled={busy || i === items.length - 1} title="Move down" className={ghostBtnCls}>↓</button>
                                <button onClick={() => startEditSub(item.id!, item.label, item.value)} className={ghostBtnCls}>Edit</button>
                                <button onClick={() => deleteSub(item.id!, item.label)} disabled={busy} className={ghostBtnCls}>Delete</button>
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {!readOnly && (
                  <div className="px-5 py-3 border-t border-[var(--border)]">
                    {addingIn === group.id ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          autoFocus
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addSub(group.id);
                            if (e.key === "Escape") setAddingIn(null);
                          }}
                          placeholder="e.g. Loafers"
                          className={`${inputCls} flex-1 min-w-[160px]`}
                        />
                        <select value={newValue} onChange={(e) => setNewValue(e.target.value)} className={inputCls}>
                          {CATEGORY_VALUES.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                        <button onClick={() => addSub(group.id)} disabled={busy || !newLabel.trim()} className={btnCls}>Add</button>
                        <button onClick={() => setAddingIn(null)} className={ghostBtnCls}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingIn(group.id);
                          setNewLabel("");
                          // Default to whatever the group's other labels use, so
                          // the common case is one field and a click.
                          setNewValue(items[0]?.value ?? CATEGORY_VALUES[0]);
                        }}
                        className={ghostBtnCls}
                      >
                        + Add subcategory
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {!readOnly && (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-4 flex items-center gap-2">
              <input
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addGroup(); }}
                placeholder="New group — e.g. Swimwear"
                className={`${inputCls} flex-1`}
              />
              <button onClick={addGroup} disabled={busy || !newGroupLabel.trim()} className={btnCls}>Add group</button>
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-[11px] text-[var(--foreground-muted)] leading-relaxed max-w-2xl">
        The value on the right is what a product stores as its <span className="font-mono">category</span> — the
        bucket the importers, the stylist and the search all reason about. Several labels can share one:
        Sneakers, Sandals and Boots are all <span className="font-mono">footwear</span>. Renaming a label
        renames it on its products, changing the value moves them, and deleting it clears the label but
        leaves the pieces in the catalog.
      </p>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 text-xs tracking-wide shadow-lg rounded-xl ${
          toast.type === "ok" ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
