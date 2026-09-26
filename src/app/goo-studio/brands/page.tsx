"use client";

import { useState, useEffect, useRef } from "react";

interface Brand {
  name: string;
  logoUrl: string | null;
}

/** Same ceiling /api/admin/brand-logo enforces; checked here to fail before the upload. */
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

const inputCls =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)] w-full";
const PRIMARY =
  "shrink-0 bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed";
const GHOST =
  "border border-[var(--border)] px-3 py-1.5 rounded-lg text-[11px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] disabled:opacity-40 transition-colors";

const errorMessage = (e: unknown) => (e instanceof Error && e.message ? e.message : "Could not reach the server.");

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  // Guards against a second Enter landing before the re-render that disables the form.
  const savingRef = useRef(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [logoBusyName, setLogoBusyName] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoTargetRef = useRef<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState("");

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    // Errors stay up long enough to read the fix they name.
    toastTimer.current = setTimeout(() => setToast(null), type === "err" ? 6000 : 3000);
  };

  const fetchBrands = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/brands", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setLoadError(data?.error || `Could not load brands (HTTP ${res.status}).`);
        setBrands([]);
        return;
      }
      setBrands(data as Brand[]);
    } catch (e) {
      setLoadError(errorMessage(e));
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || savingRef.current) return;
    if (brands.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
      showToast("Brand already exists.", "err");
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
        showToast(json.error || `Could not add the brand (HTTP ${res.status}).`, "err");
        return;
      }
      setBrands((prev) =>
        [...prev, { name: json.name ?? name, logoUrl: null }].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewName("");
      showToast("Brand added.");
    } catch (e) {
      showToast(errorMessage(e), "err");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete brand "${name}"?`)) return;
    setDeletingName(name);
    try {
      const res = await fetch(`/api/brands/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.error || `Could not delete the brand (HTTP ${res.status}).`, "err");
        return;
      }
      setBrands((prev) => prev.filter((b) => b.name !== name));
      showToast("Brand deleted.");
    } catch (e) {
      showToast(errorMessage(e), "err");
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
      showToast("The logo must be an image file.", "err");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      showToast("The logo must be 5 MB or smaller.", "err");
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
        showToast(json.error || `Could not upload the logo (HTTP ${res.status}).`, "err");
        return;
      }
      setBrands((prev) => prev.map((b) => (b.name === name ? { ...b, logoUrl: json.logoUrl ?? null } : b)));
      showToast("Logo updated.");
    } catch (e) {
      showToast(errorMessage(e), "err");
    } finally {
      setLogoBusyName(null);
    }
  };

  const handleLogoRemove = async (name: string) => {
    if (!confirm(`Remove the logo of "${name}"? The storefront falls back to the store's site icon.`)) return;
    setLogoBusyName(name);
    try {
      const res = await fetch(`/api/admin/brand-logo?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.error || `Could not remove the logo (HTTP ${res.status}).`, "err");
        return;
      }
      setBrands((prev) => prev.map((b) => (b.name === name ? { ...b, logoUrl: null } : b)));
      showToast("Logo removed.");
    } catch (e) {
      showToast(errorMessage(e), "err");
    } finally {
      setLogoBusyName(null);
    }
  };

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Brands</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
            {loading || loadError
              ? "Used in product autocomplete"
              : `${brands.length} brand${brands.length !== 1 ? "s" : ""} · used in product autocomplete`}
            {" "}· a logo shows beside the store of that name in &ldquo;Where to buy&rdquo;
          </p>
        </div>
      </div>

      {/* Load failure — said once, with the server's own words */}
      {loadError && (
        <div role="alert" className="mb-6 rounded-xl border border-red-400/30 bg-red-400/15 px-4 py-3">
          <p className="text-[13px] text-red-500 leading-relaxed">{loadError}</p>
          <button onClick={fetchBrands} className={`${GHOST} mt-3`}>
            Retry
          </button>
        </div>
      )}

      {/* Add brand */}
      <div className="mb-8 rounded-xl border border-[var(--border)] p-5" style={{ background: "var(--background)" }}>
        <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Add brand</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="e.g. Toteme, Arket, Sandro…"
            className={inputCls}
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className={PRIMARY}
          >
            {saving ? "…" : "Add"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands…"
          className={inputCls}
        />
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

      {/* Brand list */}
      <div className="rounded-xl border border-[var(--border)]" style={{ background: "var(--background)" }}>
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
            Loading…
          </div>
        ) : loadError ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
            Could not load brands.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
            {search ? "No brands match your search." : "No brands yet."}
          </div>
        ) : (
          <ul>
            {filtered.map((brand, i) => {
              const logoBusy = logoBusyName === brand.name;
              return (
                <li
                  key={brand.name}
                  className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${
                    i !== filtered.length - 1 ? "border-b border-[var(--border)]" : ""
                  } hover:bg-[var(--surface)] transition-colors`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    {brand.logoUrl ? (
                      // White behind the logo on purpose, like a product photo:
                      // it is how the storefront's store chip shows it.
                      <span className="w-8 h-8 shrink-0 rounded-full bg-white border border-[var(--border)] overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={brand.logoUrl}
                          alt={`${brand.name} logo`}
                          width={32}
                          height={32}
                          className="object-contain w-full h-full p-1"
                        />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="w-8 h-8 shrink-0 rounded-full border border-dashed border-[var(--border)]"
                      />
                    )}
                    <span className="text-sm text-[var(--foreground)] truncate">{brand.name}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => pickLogo(brand.name)}
                      disabled={logoBusy}
                      className={GHOST}
                    >
                      {logoBusy ? "Working…" : brand.logoUrl ? "Replace logo" : "Upload logo"}
                    </button>
                    {brand.logoUrl && (
                      <button
                        onClick={() => handleLogoRemove(brand.name)}
                        disabled={logoBusy}
                        className={`${GHOST} hover:text-red-500 hover:border-red-500`}
                      >
                        Remove logo
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(brand.name)}
                      disabled={deletingName === brand.name}
                      title="Delete brand"
                      aria-label={`Delete brand ${brand.name}`}
                      className="ml-1 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role={toast.type === "err" ? "alert" : "status"}
          className={`fixed bottom-6 right-6 z-50 max-w-md px-4 py-3 text-xs tracking-wide rounded-xl border ${
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
