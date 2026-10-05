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
 *
 * Layout per the mockup "Categories" (GS4-12): PageHeader with "Add group" in
 * a side panel, the explanation behind "?", one panel per group.
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  CATEGORY_VALUES,
  bucketsInTree,
  isBuiltInBucket,
  normalizeSlug,
  type CategoryGroup,
} from "@/lib/categories";
import { invalidateCategoryTree } from "@/lib/hooks/useCategoryTree";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { PageHeader, PLUS } from "@/components/admin/PageHeader";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { RowMenu, type MenuItem } from "@/components/admin/Menu";
import { SidePanel } from "@/components/admin/SidePanel";
import { BANNER, btn, BTN_ICON_SM, FIELD_LABEL, INPUT, SELECT } from "../_ui/recipes";
import { useFormat, useT } from "../_i18n";

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

/** The migrations that move the tree into the database, in the order they run. */
const TREE_MIGRATIONS = ["supabase/migrations/011_category_tree.sql", "013_subcategory_sizes.sql"] as const;

/** Code names the help text points at: the product field and an example value. */
const FIELD_CATEGORY = "category";
const EXAMPLE_BUCKET = "footwear";

/** Sentinel option that swaps the picker for a free-text field. */
const NEW_BUCKET = "\u0000new-bucket";

/**
 * A dictionary message with React nodes in its {slots}: the bold lead-in of a
 * help paragraph, a file name or a value in code type.
 */
function rich(text: string, slots: Record<string, ReactNode>): ReactNode[] {
  return text
    .split(/\{(\w+)\}/g)
    .map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{part in slots ? slots[part] : `{${part}}`}</Fragment> : part));
}

const ARROW_UP = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ARROW_DOWN = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PENCIL = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M11 2.5L13.5 5 6 12.5l-3 .5.5-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

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
  const t = useT();
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
        placeholder={t("categories.bucket.placeholder")}
        title={t("categories.bucket.hint")}
        aria-label={t("categories.storedAs")}
        className={`${INPUT} w-40`}
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
      aria-label={t("categories.storedAs")}
      className={SELECT}
    >
      <optgroup label={t("categories.bucket.builtIn")}>
        {CATEGORY_VALUES.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </optgroup>
      {custom.length > 0 && (
        <optgroup label={t("categories.bucket.custom")}>
          {custom.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </optgroup>
      )}
      <option value={NEW_BUCKET}>{t("categories.bucket.new")}</option>
    </select>
  );
}

/** Spelled out wherever a custom bucket is chosen, so it is never a surprise. */
function CustomBucketNote({ value }: { value: string }) {
  const t = useT();
  if (!value || isBuiltInBucket(value)) return null;
  return (
    <p className="basis-full text-[12px] text-[var(--warn)] leading-relaxed">
      {rich(t("categories.customNote"), { value: <span className="font-mono">{value}</span> })}
    </p>
  );
}

export default function AdminCategoriesPage() {
  const t = useT();
  const f = useFormat();
  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  /** Why the last load failed: the server's own words, its HTTP status, or no answer at all. */
  const [loadError, setLoadError] = useState<{ text?: string; status?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const help = useHelp("categories");

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
  /** The "Add group" form is open in the side panel. */
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState("");

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
        setLoadError({ text: json?.error != null ? String(json.error) : undefined, status: res.status });
        return;
      }
      setTree(json as TreeResponse);
      setLoadError(null);
    } catch {
      setLoadError({});
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
        toast.err(String(json.error ?? t("categories.failed")));
        return null;
      }
      invalidateCategoryTree();
      await load();
      return json;
    } catch {
      toast.err(t("common.networkError"));
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
      if (json.warning) toast.err(String(json.warning));
      else toast.ok(moved ? t("categories.savedMoved", { count: moved }) : t("common.saved"));
      setEditing(null);
    }
  };

  const deleteSub = async (id: number, label: string) => {
    const n = counts?.byLabel[label] ?? 0;
    const ok = await confirm({
      title: t("categories.confirm.deleteSub", { name: label }),
      body: n ? t("categories.confirm.deleteSubBody", { count: n }) : undefined,
      confirmLabel: t("categories.confirm.deleteSubAction"),
      tone: "danger",
    });
    if (!ok) return;
    const json = await send({ url: `/api/categories?kind=subcategory&id=${id}`, method: "DELETE" });
    if (json) {
      const cleared = Number(json.productsUpdated ?? 0);
      if (json.warning) toast.err(String(json.warning));
      else toast.ok(cleared ? t("categories.deletedCleared", { count: cleared }) : t("categories.deleted"));
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
      toast.ok(t("categories.added", { name: label }));
      setNewLabel("");
      setAddingIn(null);
    }
  };

  /* ── Group actions ── */

  const openAddGroup = () => {
    setNewGroupLabel("");
    setGroupPanelOpen(true);
  };

  const addGroup = async () => {
    if (busy) return;
    const label = newGroupLabel.trim();
    if (!label) return;
    const json = await post({ kind: "group", label });
    if (json) {
      toast.ok(t("categories.added", { name: label }));
      setNewGroupLabel("");
      setGroupPanelOpen(false);
    }
  };

  const startEditGroup = (group: CategoryGroup) => {
    setEditing(`group:${group.id}`);
    setDraftLabel(group.label);
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
      toast.ok(t("common.saved"));
      setEditing(null);
    }
  };

  const deleteGroup = async (id: string, label: string) => {
    if (!(await confirm({ title: t("categories.confirm.deleteGroup", { name: label }), confirmLabel: t("categories.group.delete"), tone: "danger" }))) return;
    const json = await send({ url: `/api/categories?kind=group&id=${encodeURIComponent(id)}`, method: "DELETE" });
    if (json) toast.ok(t("categories.groupDeleted"));
  };

  /* ── Menus ── */

  // Rename is also the button beside the menu; Delete waits for an empty group.
  const groupItems = (group: CategoryGroup): MenuItem[] => {
    const hasItems = group.items.length > 0;
    return [
      { label: t("categories.rename"), onSelect: () => startEditGroup(group) },
      { kind: "separator" },
      {
        label: t("categories.group.delete"),
        onSelect: () => void deleteGroup(group.id, group.label),
        tone: "danger",
        disabled: busy || hasItems,
        hint: hasItems ? t("categories.group.deleteHint") : undefined,
      },
    ];
  };

  // Edit is also the pencil beside the menu (hidden on a phone, where the menu has room).
  const subItems = (groupId: string, item: CategoryGroup["items"][number]): MenuItem[] => [
    { label: t("categories.row.edit"), onSelect: () => startEditSub(groupId, item) },
    { kind: "separator" },
    { label: t("categories.row.delete"), onSelect: () => void deleteSub(item.id!, item.label), tone: "danger", disabled: busy },
  ];

  /* ── Render ── */

  const groups = tree?.groups ?? [];
  const totalSubs = groups.reduce((n, g) => n + g.items.length, 0);
  // Built-ins plus whatever the tree has already invented. A custom bucket has
  // no table of its own — it lives exactly as long as a subcategory names it.
  const knownBuckets = bucketsInTree(groups);

  const subtitle = tree
    ? [t("categories.groups", { count: groups.length }), t("categories.subcategories", { count: totalSubs }), t("categories.drives")].join(" · ")
    : t("categories.drivesStart");

  const loadErrorText = loadError
    ? loadError.text || (loadError.status ? t("categories.loadFailed", { status: loadError.status }) : t("categories.noAnswer"))
    : "";

  const lead = (text: string) => <strong className="text-[var(--foreground)] font-medium">{text}</strong>;

  return (
    <div>
      <PageHeader
        title={t("nav.categories")}
        titleExtra={<HelpButton help={help} label={t("categories.help.label")} />}
        subtitle={subtitle}
        primary={readOnly ? undefined : { key: "add", label: t("categories.addGroup"), icon: PLUS, onClick: openAddGroup }}
      />
      {help.open && (
        <div className="-mt-4 mb-6">
          <HelpPanel help={help}>
            <p>{rich(t("categories.help.groups"), { lead: lead(t("categories.help.groupsLead")) })}</p>
            <p>
              {rich(t("categories.help.value"), {
                lead: lead(t("categories.help.valueLead")),
                category: <span className="font-mono">{FIELD_CATEGORY}</span>,
                footwear: <span className="font-mono">{EXAMPLE_BUCKET}</span>,
              })}
            </p>
            <p>{rich(t("categories.help.builtIn"), { lead: lead(t("categories.help.builtInLead")) })}</p>
          </HelpPanel>
        </div>
      )}

      {loadError && (
        <div role="alert" className={`${BANNER.err} mb-6 flex flex-wrap items-center justify-between gap-4`}>
          <p>
            {loadErrorText}
            {tree ? ` ${t("categories.outOfDate")}` : ""}
          </p>
          <button onClick={() => load()} disabled={loading} className={`${btn("ghost")} shrink-0`}>
            {loading ? t("categories.retrying") : t("common.retry")}
          </button>
        </div>
      )}

      {noDatabase && (
        <div className={`${BANNER.warn} mb-6`}>
          <p>{t("categories.noDatabase")}</p>
        </div>
      )}

      {tableMissing && (
        <div className={`${BANNER.warn} mb-6`}>
          <p className="font-medium mb-1">{t("categories.tablesMissing.title")}</p>
          <p>
            {rich(t("categories.tablesMissing.text"), {
              first: <span className="font-mono">{TREE_MIGRATIONS[0]}</span>,
              second: <span className="font-mono">{TREE_MIGRATIONS[1]}</span>,
            })}
          </p>
        </div>
      )}

      {readFailed && (
        <div className={`${BANNER.warn} mb-6 flex items-center justify-between gap-4`}>
          <p>
            {tree?.detail ? t("categories.readFailedDetail", { detail: tree.detail }) : t("categories.readFailed")}
          </p>
          <button onClick={() => load()} disabled={loading} className={`${btn("ghost")} shrink-0`}>
            {loading ? t("categories.retrying") : t("common.retry")}
          </button>
        </div>
      )}

      {tablesEmpty && (
        <div className={`${BANNER.warn} mb-6`}>
          <p>{t("categories.tablesEmpty")}</p>
        </div>
      )}

      {!tree ? (
        !loadError && (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">{t("common.loading")}</div>
        )
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 items-start gap-4">
          {groups.map((group) => {
            const items = group.items;
            // A group's buckets are the distinct values its labels point at;
            // whatever sits in one without a label of its own is unsorted.
            const unassigned = [...new Set(items.map((i) => i.value))].reduce(
              (n, v) => n + (counts?.unassignedByCategory[v] ?? 0),
              0,
            );

            return (
              <section key={group.id} className="min-w-0 rounded-xl border border-[var(--border)]" style={{ background: "var(--surface)" }}>
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
                        aria-label={t("categories.field.name")}
                        className={`${INPUT} flex-1 min-w-[160px]`}
                      />
                      <button onClick={() => saveGroup(group.id, group.label)} disabled={busy} className={`${btn("primary")} shrink-0`}>
                        {t("common.save")}
                      </button>
                      <button onClick={() => setEditing(null)} className={btn("ghost")}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">{group.label}</h2>
                          <span className="text-[13px] text-[var(--foreground-muted)] tabular-nums">{f.number(items.length)}</span>
                        </div>
                        <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5 font-mono">
                          {`?category=${group.id}`}
                          {unassigned > 0 && (
                            <span className="ml-2 font-sans text-[var(--warn)]">
                              {t("categories.unassigned", { count: unassigned })}
                            </span>
                          )}
                        </p>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEditGroup(group)} className={btn("ghost", "sm")}>
                            {t("categories.rename")}
                          </button>
                          <RowMenu size="sm" label={t("menu.moreFor", { name: group.label })} items={groupItems(group)} />
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
                      <li key={item.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--fg-overlay-05)] transition-colors">
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
                              aria-label={t("categories.field.name")}
                              className={`${INPUT} flex-1 min-w-[160px]`}
                            />
                            <span className="text-[12px] font-medium text-[var(--foreground-muted)]">{t("categories.storedAs")}</span>
                            <BucketPicker value={draftValue} known={knownBuckets} onChange={setDraftValue} />
                            <button onClick={() => saveSub(group.id, item)} disabled={busy} className={`${btn("primary")} shrink-0`}>
                              {t("common.save")}
                            </button>
                            <button onClick={() => setEditing(null)} className={btn("ghost")}>
                              {t("common.cancel")}
                            </button>
                            <CustomBucketNote value={draftValue} />
                            <div className="basis-full flex items-center gap-2 flex-wrap pt-1">
                              <span className="text-[12px] font-medium text-[var(--foreground-muted)]">{t("categories.group")}</span>
                              <select
                                value={draftGroup}
                                onChange={(e) => setDraftGroup(e.target.value)}
                                aria-label={t("categories.group")}
                                className={SELECT}
                                title={t("categories.groupHint")}
                              >
                                {groups.map((g) => (
                                  <option key={g.id} value={g.id}>{g.label}</option>
                                ))}
                              </select>
                              <span className="text-[12px] font-medium text-[var(--foreground-muted)]">{t("categories.sizes")}</span>
                              <input
                                value={draftSizes}
                                onChange={(e) => setDraftSizes(e.target.value)}
                                placeholder={t("categories.sizesPlaceholder")}
                                title={t("categories.sizesHint")}
                                aria-label={t("categories.sizes")}
                                className={`${INPUT} flex-1 min-w-[220px]`}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* On a phone the name has the first line to itself; the rest goes under it. */}
                            <span className="text-sm text-[var(--foreground)] flex-1 max-md:basis-full min-w-0 truncate">{item.label}</span>
                            <span className="text-[12px] font-mono text-[var(--foreground-subtle)] shrink-0">{item.value}</span>
                            <span className="text-[12px] text-[var(--foreground-subtle)] shrink-0 hidden sm:inline" title={item.sizes?.join(", ")}>
                              {item.sizes?.length ? t("categories.sizeCount", { count: item.sizes.length }) : "—"}
                            </span>
                            <span className="text-[11px] text-[var(--foreground-muted)] tabular-nums min-w-16 text-right shrink-0">
                              {t("categories.pieces", { count: n })}
                            </span>
                            {!readOnly && item.id !== undefined && (
                              <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                                <button
                                  onClick={() => moveSub(item.id!, -1)}
                                  disabled={busy || i === 0}
                                  title={t("categories.row.moveUp", { name: item.label })}
                                  aria-label={t("categories.row.moveUp", { name: item.label })}
                                  className={BTN_ICON_SM}
                                >
                                  {ARROW_UP}
                                </button>
                                <button
                                  onClick={() => moveSub(item.id!, 1)}
                                  disabled={busy || i === items.length - 1}
                                  title={t("categories.row.moveDown", { name: item.label })}
                                  aria-label={t("categories.row.moveDown", { name: item.label })}
                                  className={BTN_ICON_SM}
                                >
                                  {ARROW_DOWN}
                                </button>
                                <button
                                  onClick={() => startEditSub(group.id, item)}
                                  title={t("categories.row.editFor", { name: item.label })}
                                  aria-label={t("categories.row.editFor", { name: item.label })}
                                  className={`${BTN_ICON_SM} max-md:hidden`}
                                >
                                  {PENCIL}
                                </button>
                                <RowMenu size="sm" label={t("menu.moreFor", { name: item.label })} items={subItems(group.id, item)} />
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
                          placeholder={t("categories.subPlaceholder")}
                          aria-label={t("categories.field.name")}
                          className={`${INPUT} flex-1 min-w-[160px]`}
                        />
                        <span className="text-[12px] font-medium text-[var(--foreground-muted)]">{t("categories.storedAs")}</span>
                        <BucketPicker value={newValue} known={knownBuckets} onChange={setNewValue} />
                        <button onClick={() => addSub(group.id)} disabled={busy || !newLabel.trim() || !newValue} className={`${btn("primary")} shrink-0`}>
                          {t("categories.add")}
                        </button>
                        <button onClick={() => setAddingIn(null)} className={btn("ghost")}>
                          {t("common.cancel")}
                        </button>
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
                        className={btn("ghost")}
                      >
                        {PLUS}
                        {t("categories.addSub")}
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Add group, in the side panel (ADMIN_DESIGN 5.10) ── */}
      <SidePanel
        open={groupPanelOpen}
        onClose={() => setGroupPanelOpen(false)}
        title={t("categories.addGroup")}
        footer={
          <>
            <button onClick={() => setGroupPanelOpen(false)} className={btn("ghost")}>
              {t("common.cancel")}
            </button>
            <button onClick={addGroup} disabled={busy || !newGroupLabel.trim()} className={btn("primary")}>
              {busy ? t("categories.adding") : t("categories.addGroup")}
            </button>
          </>
        }
      >
        <label htmlFor="category-group-name" className={FIELD_LABEL}>
          {t("categories.field.name")}
        </label>
        <input
          id="category-group-name"
          value={newGroupLabel}
          onChange={(e) => setNewGroupLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addGroup(); }}
          placeholder={t("categories.field.groupPlaceholder")}
          className={`${INPUT} w-full`}
        />
      </SidePanel>
    </div>
  );
}
