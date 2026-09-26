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
import {
  CATEGORY_VALUES,
  bucketsInTree,
  isBuiltInBucket,
  normalizeSlug,
  type CategoryGroup,
} from "@/lib/categories";
import { invalidateCategoryTree } from "@/lib/hooks/useCategoryTree";

interface Counts {
  byLabel: Record<string, number>;
  unassignedByCategory: Record<string, number>;
}

interface TreeResponse {
  groups: CategoryGroup[];
  source: "db" | "default";
  /** Why the built-in tree is shown, or `tables-empty` for a tree emptied out. */
  reason?: "no-database" | "tables-missing" | "tables-empty" | "read-failed";
  detail?: string;
  counts?: Counts;
}

const inputCls =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";
const btnCls =
  "shrink-0 bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed";
const warnBoxCls = "mb-6 rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-3";
const ghostBtnCls =
  "text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40";

/** Sentinel option that swaps the picker for a free-text field. */
const NEW_BUCKET = "\u0000new-bucket";

/**
 * Picks the category value a subcategory points at.
 *
 * Built-in buckets come first because the code knows them — the importer's
 * classifier can assign them, the outfit builder slots them, they have size
 * presets. Buckets already invented in the tree come next, and the last option
 * invents another. Nothing stops a custom one; the caller warns what it costs.
 */
function BucketPicker({
  value,
  known,
  onChange,
}: {
  value: string;
  known: string[];
  onChange: (value: string) => void;
}) {
  const [typing, setTyping] = useState(false);
  const custom = known.filter((v) => !isBuiltInBucket(v));

  if (typing) {
    return (
      <input
        autoFocus
        value={value}
        // Normalized when the field is left, not per keystroke: a dash typed
        // mid-word is trailing at that moment and would be stripped.
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        onBlur={(e) => onChange(normalizeSlug(e.target.value))}
        placeholder="e.g. other"
        title="Letters, digits and dashes — 2 to 32 characters"
        className={`${inputCls} w-40`}
      />
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === NEW_BUCKET) {
          onChange("");
          setTyping(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={inputCls}
    >
      <optgroup label="Built-in">
        {CATEGORY_VALUES.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </optgroup>
      {custom.length > 0 && (
        <optgroup label="Custom">
          {custom.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </optgroup>
      )}
      <option value={NEW_BUCKET}>＋ new value…</option>
    </select>
  );
}

/** Spelled out wherever a custom bucket is chosen, so it is never a surprise. */
function CustomBucketNote({ value }: { value: string }) {
  if (!value || isBuiltInBucket(value)) return null;
  return (
    <p className="basis-full text-[10px] text-amber-500 leading-relaxed">
      <span className="font-mono">{value}</span> is a value of your own. Filters, breadcrumbs and the
      product editor handle it, but the code has no other knowledge of it: pieces stored under it
      stay out of the outfit builder, imports never classify into it on their own, and it has no
      size preset.
    </p>
  );
}

export default function AdminCategoriesPage() {
  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  /** Which row is open for editing: `sub:12` or `group:footwear`. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [draftGroup, setDraftGroup] = useState("");
  const [draftSizes, setDraftSizes] = useState("");

  /** The "add subcategory" row, keyed by the group it sits under. */
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newGroupLabel, setNewGroupLabel] = useState("");

  const showToast = (msg: string, type: "ok" | "err" = "ok") => setToast({ msg, type });

  // One timer per toast, so a second toast is not cut short by the first's.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * Reloads the tree in place. The list stays mounted while it does — only
   * the very first load shows "Loading…" — so the page keeps its scroll
   * position across edits. A failed reload keeps what is on screen and says so.
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories?counts=1", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || !Array.isArray(json.groups)) {
        setLoadError(String(json?.error ?? `Couldn't load categories (${res.status}).`));
        return;
      }
      setTree(json as TreeResponse);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load categories — the server did not answer.");
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
  const readFailed = tree?.source === "default" && tree?.reason === "read-failed";
  const tablesEmpty = tree?.source === "db" && tree?.reason === "tables-empty";
  const readOnly = tree?.source !== "db";
  const counts = tree?.counts;

  /* ── Subcategory actions ── */

  const startEditSub = (groupId: string, item: CategoryGroup["items"][number]) => {
    setEditing(`sub:${item.id}`);
    setDraftLabel(item.label);
    setDraftValue(item.value);
    setDraftGroup(groupId);
    setDraftSizes((item.sizes ?? []).join(", "));
  };

  const saveSub = async (groupId: string, before: CategoryGroup["items"][number]) => {
    if (busy || before.id === undefined) return;
    const body: Record<string, unknown> = { kind: "subcategory", id: before.id };
    const value = normalizeSlug(draftValue);
    if (draftLabel.trim() && draftLabel.trim() !== before.label) body.label = draftLabel.trim();
    if (value && value !== before.value) body.value = value;
    if (draftGroup && draftGroup !== groupId) body.groupId = draftGroup;
    // Sent whenever it differs from what was loaded, including when cleared —
    // an empty list is a real choice, meaning "use the category's chart".
    if (draftSizes.trim() !== (before.sizes ?? []).join(", ")) body.sizes = draftSizes;
    if (Object.keys(body).length === 2) {
      setEditing(null);
      return;
    }
    const json = await patch(body);
    if (json) {
      const moved = Number(json.productsUpdated ?? 0);
      if (json.warning) showToast(String(json.warning), "err");
      else showToast(moved ? `Saved — ${moved} product${moved === 1 ? "" : "s"} updated.` : "Saved.");
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
      if (json.warning) showToast(String(json.warning), "err");
      else showToast(cleared ? `Deleted — ${cleared} product${cleared === 1 ? "" : "s"} cleared.` : "Deleted.");
    }
  };

  /** Swaps a subcategory with its neighbour — one server call, so it cannot half-happen. */
  const moveSub = async (id: number, delta: -1 | 1) => {
    if (busy) return;
    await patch({ kind: "subcategory", id, move: delta < 0 ? "up" : "down" });
  };

  const addSub = async (groupId: string) => {
    if (busy) return;
    const label = newLabel.trim();
    const value = normalizeSlug(newValue);
    if (!label || !value) return;
    // No sort order sent: the server puts it after the group's highest one.
    const json = await post({ kind: "subcategory", groupId, label, value });
    if (json) {
      showToast(`"${label}" added.`);
      setNewLabel("");
      setAddingIn(null);
    }
  };

  /* ── Group actions ── */

  const addGroup = async () => {
    if (busy) return;
    const label = newGroupLabel.trim();
    if (!label) return;
    const json = await post({ kind: "group", label });
    if (json) {
      showToast(`"${label}" added.`);
      setNewGroupLabel("");
    }
  };

  const saveGroup = async (id: string, before: string) => {
    if (busy) return;
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
  // Built-ins plus whatever the tree has already invented. A custom bucket has
  // no table of its own — it lives exactly as long as a subcategory names it.
  const knownBuckets = bucketsInTree(groups);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Categories</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
          {tree
            ? `${groups.length} group${groups.length === 1 ? "" : "s"} · ${totalSubs} subcategor${totalSubs === 1 ? "y" : "ies"} · `
            : ""}
          drives the catalog filters, the product editor and breadcrumbs
        </p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/15 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-red-500 leading-relaxed">
            {loadError}
            {tree ? " What is shown may be out of date." : ""}
          </p>
          <button onClick={() => load()} disabled={loading} className={`${ghostBtnCls} shrink-0`}>
            {loading ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {noDatabase && (
        <div className={warnBoxCls}>
          <p className="text-[13px] text-amber-500 leading-relaxed">
            Supabase is not configured — this is the built-in tree, and it can&apos;t be edited from here.
          </p>
        </div>
      )}

      {tableMissing && (
        <div className={warnBoxCls}>
          <p className="text-[13px] font-medium text-amber-500 mb-1">Category tables not found</p>
          <p className="text-[13px] text-amber-500 leading-relaxed">
            You&apos;re looking at the tree hardcoded in the app, which is read-only. Run{" "}
            <span className="font-mono">supabase/migrations/011_category_tree.sql</span>, then{" "}
            <span className="font-mono">013_subcategory_sizes.sql</span>, to move it into the database and make it
            editable here.
          </p>
        </div>
      )}

      {readFailed && (
        <div className={`${warnBoxCls} flex items-center justify-between gap-4`}>
          <p className="text-[13px] text-amber-500 leading-relaxed">
            Couldn&apos;t read the category tables, so this is the built-in tree, read-only
            {tree?.detail ? `: ${tree.detail}` : "."}
          </p>
          <button onClick={() => load()} disabled={loading} className={`${ghostBtnCls} shrink-0`}>
            {loading ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {tablesEmpty && (
        <div className={warnBoxCls}>
          <p className="text-[13px] text-amber-500 leading-relaxed">
            The tree is empty, so the storefront shows the built-in one until you add a group below.
          </p>
        </div>
      )}

      {!tree ? (
        !loadError && (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Loading…</div>
        )
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
                <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--border)]">
                  {editing === `group:${group.id}` ? (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <input
                        autoFocus
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveGroup(group.id, group.label);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className={`${inputCls} flex-1 min-w-[160px]`}
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
                            <span className="ml-2 font-sans text-amber-500">
                              {unassigned} piece{unassigned === 1 ? "" : "s"} with no subcategory
                            </span>
                          )}
                        </p>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-3 shrink-0">
                          <button onClick={() => { setEditing(`group:${group.id}`); setDraftLabel(group.label); }} className={ghostBtnCls}>Rename</button>
                          <button
                            onClick={() => deleteGroup(group.id, group.label)}
                            disabled={busy || items.length > 0}
                            title={items.length > 0 ? "Move or delete its subcategories first" : undefined}
                            className={ghostBtnCls}
                          >
                            Delete
                          </button>
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
                      <li key={item.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 flex-wrap">
                            <input
                              autoFocus
                              value={draftLabel}
                              onChange={(e) => setDraftLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveSub(group.id, item);
                                if (e.key === "Escape") setEditing(null);
                              }}
                              className={`${inputCls} flex-1 min-w-[160px]`}
                            />
                            <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">stored as</span>
                            <BucketPicker value={draftValue} known={knownBuckets} onChange={setDraftValue} />
                            <button onClick={() => saveSub(group.id, item)} disabled={busy} className={btnCls}>Save</button>
                            <button onClick={() => setEditing(null)} className={ghostBtnCls}>Cancel</button>
                            <CustomBucketNote value={draftValue} />
                            <div className="basis-full flex items-center gap-2 flex-wrap pt-1">
                              <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">group</span>
                              <select
                                value={draftGroup}
                                onChange={(e) => setDraftGroup(e.target.value)}
                                className={inputCls}
                                title="Moving it to another group puts it at the end of that group"
                              >
                                {groups.map((g) => (
                                  <option key={g.id} value={g.id}>{g.label}</option>
                                ))}
                              </select>
                              <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">sizes</span>
                              <input
                                value={draftSizes}
                                onChange={(e) => setDraftSizes(e.target.value)}
                                placeholder="Empty — use the category's chart"
                                title="The sizes offered in the product editor, in order. Leave empty to use the category's chart."
                                className={`${inputCls} flex-1 min-w-[220px]`}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm text-[var(--foreground)] flex-1 min-w-0 truncate">{item.label}</span>
                            <span className="text-[10px] font-mono text-[var(--foreground-subtle)] shrink-0">{item.value}</span>
                            <span className="text-[10px] text-[var(--foreground-subtle)] shrink-0 hidden sm:inline" title={item.sizes?.join(", ")}>
                              {item.sizes?.length ? `sizes ×${item.sizes.length}` : "—"}
                            </span>
                            <span className="text-[10px] text-[var(--foreground-muted)] tabular-nums w-16 text-right shrink-0">
                              {n} piece{n === 1 ? "" : "s"}
                            </span>
                            {!readOnly && item.id !== undefined && (
                              <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                                <button onClick={() => moveSub(item.id!, -1)} disabled={busy || i === 0} title="Move up" aria-label={`Move ${item.label} up`} className={ghostBtnCls}>↑</button>
                                <button onClick={() => moveSub(item.id!, 1)} disabled={busy || i === items.length - 1} title="Move down" aria-label={`Move ${item.label} down`} className={ghostBtnCls}>↓</button>
                                <button onClick={() => startEditSub(group.id, item)} className={ghostBtnCls}>Edit</button>
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
                        <span className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">stored as</span>
                        <BucketPicker value={newValue} known={knownBuckets} onChange={setNewValue} />
                        <button onClick={() => addSub(group.id)} disabled={busy || !newLabel.trim() || !newValue} className={btnCls}>Add</button>
                        <button onClick={() => setAddingIn(null)} className={ghostBtnCls}>Cancel</button>
                        <CustomBucketNote value={newValue} />
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
            <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-4 flex flex-wrap items-center gap-2">
              <input
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addGroup(); }}
                placeholder="New group — e.g. Swimwear"
                className={`${inputCls} flex-1 min-w-[160px]`}
              />
              <button onClick={addGroup} disabled={busy || !newGroupLabel.trim()} className={btnCls}>Add group</button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 text-[11px] text-[var(--foreground-muted)] leading-relaxed max-w-2xl flex flex-col gap-2">
        <p>
          <strong className="text-[var(--foreground)] font-medium">Groups and subcategories</strong> are what a
          shopper sees in the filters, and they are yours to name. Renaming a subcategory renames it on its
          products, and deleting it clears the label but leaves the pieces in the catalog.
        </p>
        <p>
          <strong className="text-[var(--foreground)] font-medium">The value beside each one</strong> is a
          different thing: the <span className="font-mono">category</span> its products are stored under.
          Several subcategories can share one — Sneakers, Sandals and Boots are all{" "}
          <span className="font-mono">footwear</span> — and changing it moves that subcategory&apos;s products
          into the new one.
        </p>
        <p>
          The <strong className="text-[var(--foreground)] font-medium">built-in</strong> values are the ones the
          rest of the app understands: imports classify into them, the outfit builder slots them, they carry
          size presets. You can invent your own for a group they have no name for — the catalog handles it
          fine, it just gets none of that.
        </p>
      </div>

      {toast && (
        <div
          role={toast.type === "ok" ? "status" : "alert"}
          className={`fixed bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 z-50 px-4 py-3 text-xs tracking-wide rounded-xl border ${
            toast.type === "ok"
              ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
              : "bg-[var(--background)] text-red-500 border-red-400/30"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
