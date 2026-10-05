"use client";

import { useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { PageHeader, PLUS } from "@/components/admin/PageHeader";
import { DataTable, EmptyState, type Column } from "@/components/admin/DataTable";
import { SearchField } from "@/components/admin/FilterBar";
import { RowMenu, type MenuItem } from "@/components/admin/Menu";
import { SidePanel } from "@/components/admin/SidePanel";
import { btn, BTN_ICON_SM, FIELD_LABEL, INPUT } from "../_ui/recipes";
import { useT } from "../_i18n";

/*
 * Brands (docs/ADMIN_DESIGN.md §6, mockup "Brands", GS4-12): the directory
 * product autocomplete draws on, and the logo shown beside the store of the
 * same name in "Where to buy". A brand is added in the side panel; a row's
 * logo and its deletion are the row's actions.
 */

interface Brand {
  name: string;
  logoUrl: string | null;
}

/** Same ceiling /api/admin/brand-logo enforces; checked here to fail before the upload. */
const LOGO_MAX_MB = 5;
const LOGO_MAX_BYTES = LOGO_MAX_MB * 1024 * 1024;

/** Why the list did not load: the server's own words, or its HTTP status. */
type LoadError = { text?: string; status?: number };

/** "ZA" for Zara, "AO" for adidas Originals, "AP" for A.P.C.: what stands in for a missing logo. */
function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => [...w].filter((c) => /[\p{L}\p{N}]/u.test(c)))
    .filter((w) => w.length > 0);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? []).slice(0, 2).join("");
  return letters.toUpperCase();
}

/**
 * The logo in the row's 40px tile (56px on a phone's card). White behind it
 * on purpose, like a product photo: it is how the storefront's store chip
 * shows it. Without a logo, the initials in a dashed tile.
 */
function LogoTile({ brand, size = "md" }: { brand: Brand; size?: "md" | "lg" }) {
  const t = useT();
  const box = size === "lg" ? "w-14 h-14 rounded-lg" : "w-10 h-10 rounded-md";
  if (!brand.logoUrl) {
    return (
      <span
        title={t("brands.noLogo")}
        className={`${box} flex-shrink-0 inline-flex items-center justify-center border border-dashed border-[var(--border-strong)] text-[11px] font-semibold text-[var(--foreground-muted)]`}
      >
        <span aria-hidden="true">{initials(brand.name)}</span>
      </span>
    );
  }
  const px = size === "lg" ? 56 : 40;
  return (
    <span className={`${box} flex-shrink-0 overflow-hidden inline-flex items-center justify-center bg-white border border-[var(--border)]`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brand.logoUrl}
        alt={t("brands.logoAlt", { name: brand.name })}
        width={px}
        height={px}
        className="object-contain w-full h-full p-1"
      />
    </span>
  );
}

const TRASH = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function AdminBrandsPage() {
  const t = useT();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  /** The "Add brand" form is open in the side panel. */
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  // Guards against a second Enter landing before the re-render that disables the form.
  const savingRef = useRef(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [logoBusyName, setLogoBusyName] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoTargetRef = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const confirm = useConfirm();
  const toast = useToast();

  /** A failed request in the words of the error, or "could not reach the server". */
  const failure = (e: unknown) => (e instanceof Error && e.message ? e.message : t("brands.unreachable"));

  const fetchBrands = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/brands", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setLoadError({ text: data?.error, status: res.status });
        setBrands([]);
        return;
      }
      setBrands(data as Brand[]);
    } catch (e) {
      setLoadError({ text: e instanceof Error ? e.message : undefined });
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, []);

  const openAdd = () => {
    setNewName("");
    setAddOpen(true);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || savingRef.current) return;
    if (brands.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
      toast.err(t("brands.exists"));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.err(json.error || t("brands.addFailed", { status: res.status }));
        return;
      }
      setBrands((prev) =>
        [...prev, { name: json.name ?? name, logoUrl: null }].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewName("");
      setAddOpen(false);
      toast.ok(t("brands.added"));
    } catch (e) {
      toast.err(failure(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!(await confirm({ title: t("brands.confirm.delete", { name }), confirmLabel: t("brands.confirm.deleteAction"), tone: "danger" }))) return;
    setDeletingName(name);
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.err(json.error || t("brands.deleteFailed", { status: res.status }));
        return;
      }
      setBrands((prev) => prev.filter((b) => b.name !== name));
      toast.ok(t("brands.deleted"));
    } catch (e) {
      toast.err(failure(e));
    } finally {
      setDeletingName(null);
    }
  };

  const pickLogo = (name: string) => {
    logoTargetRef.current = name;
    if (logoInputRef.current) {
      // Cleared so choosing the same file again still fires onChange.
      logoInputRef.current.value = "";
      logoInputRef.current.click();
    }
  };

  const handleLogoUpload = async (name: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.err(t("brands.logo.notImage"));
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.err(t("brands.logo.tooBig", { mb: LOGO_MAX_MB }));
      return;
    }
    setLogoBusyName(name);
    try {
      const form = new FormData();
      form.append("name", name);
      form.append("file", file);
      const res = await fetch("/api/admin/brand-logo", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.err(json.error || t("brands.logo.uploadFailed", { status: res.status }));
        return;
      }
      setBrands((prev) => prev.map((b) => (b.name === name ? { ...b, logoUrl: json.logoUrl ?? null } : b)));
      toast.ok(t("brands.logo.updated"));
    } catch (e) {
      toast.err(failure(e));
    } finally {
      setLogoBusyName(null);
    }
  };

  const handleLogoRemove = async (name: string) => {
    const ok = await confirm({
      title: t("brands.confirm.removeLogo", { name }),
      body: t("brands.confirm.removeLogoBody"),
      confirmLabel: t("brands.row.remove"),
      tone: "danger",
    });
    if (!ok) return;
    setLogoBusyName(name);
    try {
      const res = await fetch(`/api/admin/brand-logo?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.err(json.error || t("brands.logo.removeFailed", { status: res.status }));
        return;
      }
      setBrands((prev) => prev.map((b) => (b.name === name ? { ...b, logoUrl: null } : b)));
      toast.ok(t("brands.logo.removed"));
    } catch (e) {
      toast.err(failure(e));
    } finally {
      setLogoBusyName(null);
    }
  };

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  // Said once, in the list, with the server's own words when it gave any.
  const loadErrorText = loadError
    ? loadError.text || (loadError.status ? t("brands.loadFailed", { status: loadError.status }) : t("brands.unreachable"))
    : "";

  // The logo's actions; deleting the brand is the icon beside the menu.
  const rowItems = (b: Brand): MenuItem[] => {
    const busy = logoBusyName === b.name;
    return [
      { label: t(b.logoUrl ? "brands.row.replace" : "brands.row.upload"), onSelect: () => pickLogo(b.name), disabled: busy },
      ...(b.logoUrl
        ? [{ label: t("brands.row.remove"), onSelect: () => void handleLogoRemove(b.name), tone: "danger" as const, disabled: busy }]
        : []),
    ];
  };

  const columns: Column<Brand>[] = [
    {
      key: "brand",
      header: t("brands.col.brand"),
      grow: true,
      cell: (b) => (
        <div className="flex items-center gap-3 min-w-0">
          <LogoTile brand={b} />
          <span className="font-medium truncate" title={b.name}>
            {b.name}
          </span>
          {logoBusyName === b.name && (
            <span role="status" className="flex-shrink-0 text-[12px] text-[var(--foreground-muted)]">
              {t("brands.logoBusy")}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("nav.brands")}
        subtitle={loading || loadError ? t("brands.subtitleNoCount") : t("brands.subtitle", { count: brands.length })}
        primary={{ key: "add", label: t("brands.add"), icon: PLUS, onClick: openAdd }}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t("brands.search.placeholder")}
          label={t("brands.search.label")}
        />
        {search && !loading && !loadError && (
          <span className="ml-auto text-[12px] text-[var(--foreground-muted)] tabular-nums">
            {t("filter.count", { shown: filtered.length, total: brands.length })}
          </span>
        )}
      </div>

      {/* One file picker for every row; the row that opened it is in logoTargetRef. */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const name = logoTargetRef.current;
          if (file && name) void handleLogoUpload(name, file);
        }}
      />

      <DataTable
        label={t("nav.brands")}
        rows={filtered}
        rowKey={(b) => b.name}
        columns={columns}
        loading={loading}
        resetKey={search}
        card={(b) => ({
          thumb: <LogoTile brand={b} size="lg" />,
          title: b.name,
          meta: logoBusyName === b.name ? t("brands.logoBusy") : b.logoUrl ? undefined : t("brands.noLogo"),
        })}
        actions={(b) => {
          const label = t("brands.row.delete", { name: b.name });
          return (
            <>
              <button
                onClick={() => handleDelete(b.name)}
                disabled={deletingName === b.name}
                aria-label={label}
                title={label}
                className={BTN_ICON_SM}
              >
                {TRASH}
              </button>
              <RowMenu size="sm" label={t("menu.moreFor", { name: b.name })} items={rowItems(b)} />
            </>
          );
        }}
        empty={
          loadError ? (
            <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <p className="text-[13px] text-[var(--err)] break-words">{loadErrorText}</p>
              <button onClick={fetchBrands} className={btn("secondary")}>
                {t("common.retry")}
              </button>
            </div>
          ) : (
            <EmptyState text={t(search ? "brands.empty.filtered" : "brands.empty.none")} />
          )
        }
      />

      {/* ── Add brand, in the side panel (ADMIN_DESIGN 5.10) ── */}
      <SidePanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t("brands.add")}
        footer={
          <>
            <button onClick={() => setAddOpen(false)} className={btn("ghost")}>
              {t("common.cancel")}
            </button>
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className={btn("primary")}>
              {saving ? t("brands.adding") : t("brands.add")}
            </button>
          </>
        }
      >
        <label htmlFor="brand-name" className={FIELD_LABEL}>
          {t("brands.field.name")}
        </label>
        <input
          id="brand-name"
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder={t("brands.field.placeholder")}
          className={`${INPUT} w-full`}
        />
      </SidePanel>
    </div>
  );
}
