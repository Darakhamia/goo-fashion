"use client";

import { useState, useEffect } from "react";

interface Brand {
  name: string;
}

const CREATE_TABLE_SQL = `create table if not exists public.brands (
  id   serial primary key,
  name text   unique not null
);
alter table public.brands enable row level security;
create policy "Public read access"
  on public.brands for select using (true);

-- Pre-populate defaults
insert into public.brands (name) values
  ('Acne Studios'),('Arket'),('& Other Stories'),('A.P.C.'),
  ('Balenciaga'),('Bottega Veneta'),('Burberry'),('Cos'),
  ('Fear of God'),('Gucci'),('Jacquemus'),('Jil Sander'),
  ('Lemaire'),('Louis Vuitton'),('Maison Margiela'),('Massimo Dutti'),
  ('Miu Miu'),('Nike'),('Prada'),('Sandro'),('The Row'),
  ('Toteme'),('Valentino'),('Zara')
on conflict (name) do nothing;`;

const inputCls =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)] w-full";

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [search, setSearch] = useState("");
  const [showSql, setShowSql] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const configRes = await fetch("/api/products/seed");
      const configured = configRes.status !== 501;
      setDbConfigured(configured);
      const res = await fetch("/api/brands");
      const missing = res.headers.get("X-Brands-Table-Missing") === "true";
      setTableMissing(missing);
      const data = await res.json();
      setBrands(Array.isArray(data) ? data : []);
    } catch {
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, []);

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(CREATE_TABLE_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    } catch {}
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (brands.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
      showToast("Brand already exists.", "err");
      return;
    }
    setSaving(true);
    if (dbConfigured && !tableMissing) {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "TABLE_MISSING") {
          // Table was missing — switch to in-memory and show SQL
          setTableMissing(true);
          setBrands((prev) => [...prev, { name }].sort((a, b) => a.name.localeCompare(b.name)));
          setNewName("");
          setSaving(false);
          return;
        }
        showToast(json.error || "Failed to add brand.", "err");
        setSaving(false);
        return;
      }
      setBrands((prev) => [...prev, json].sort((a, b) => a.name.localeCompare(b.name)));
      showToast("Brand added.");
    } else {
      // In-memory only (no DB or table missing)
      setBrands((prev) => [...prev, { name }].sort((a, b) => a.name.localeCompare(b.name)));
      showToast(tableMissing ? "Added (in-memory — create the brands table to persist)." : "Brand added (in-memory only).");
    }
    setNewName("");
    setSaving(false);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete brand "${name}"?`)) return;
    setDeletingName(name);
    if (dbConfigured) {
      const res = await fetch(`/api/brands/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.error || "Failed to delete.", "err");
        setDeletingName(null);
        return;
      }
    }
    setBrands((prev) => prev.filter((b) => b.name !== name));
    showToast("Brand deleted.");
    setDeletingName(null);
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
            {brands.length} brand{brands.length !== 1 ? "s" : ""} · used in product autocomplete
          </p>
        </div>
      </div>

      {/* DB not configured */}
      {dbConfigured === false && (
        <div className="mb-6 border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-600">
          Supabase is not configured — changes are in-memory only and won&apos;t persist between reloads.
        </div>
      )}

      {/* Brands table missing */}
      {tableMissing && dbConfigured !== false && (
        <div className="mb-6 border border-amber-500/30 bg-amber-500/5 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-amber-700 mb-1">
                Brands table not found in Supabase
              </p>
              <p className="text-[11px] text-amber-600 leading-relaxed">
                Changes are in-memory only. Run the SQL below in your{" "}
                <span className="font-medium">Supabase SQL Editor</span> to create the table and persist brands.
              </p>
            </div>
            <button
              onClick={() => setShowSql((v) => !v)}
              className="shrink-0 text-[10px] tracking-[0.1em] uppercase font-medium border border-amber-500/40 text-amber-700 px-3 py-1.5 hover:bg-amber-500/10 transition-colors"
            >
              {showSql ? "Hide SQL" : "Show SQL"}
            </button>
          </div>

          {showSql && (
            <div className="mt-3 relative">
              <pre className="text-[10px] font-mono text-amber-800 bg-amber-500/10 border border-amber-500/20 p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                {CREATE_TABLE_SQL}
              </pre>
              <button
                onClick={copySql}
                className="absolute top-2 right-2 text-[9px] tracking-[0.1em] uppercase font-medium bg-amber-600 text-white px-2.5 py-1 hover:bg-amber-700 transition-colors"
              >
                {sqlCopied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add brand */}
      <div className="mb-8 border border-[var(--border)] p-5" style={{ background: "var(--background)" }}>
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
            className="shrink-0 border border-[var(--foreground)] text-[var(--foreground)] px-5 py-2 text-xs tracking-[0.12em] uppercase hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* Brand list */}
      <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
        {loading ? (
          <div className="px-6 py-12 text-center text-xs text-[var(--foreground-muted)] tracking-wide">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-[var(--foreground-muted)] tracking-wide">
            {search ? "No brands match your search." : "No brands yet."}
          </div>
        ) : (
          <ul>
            {filtered.map((brand, i) => (
              <li
                key={brand.name}
                className={`flex items-center justify-between px-5 py-3.5 ${
                  i !== filtered.length - 1 ? "border-b border-[var(--border)]" : ""
                } hover:bg-[var(--surface)] transition-colors`}
              >
                <span className="text-sm text-[var(--foreground)]">{brand.name}</span>
                <button
                  onClick={() => handleDelete(brand.name)}
                  disabled={deletingName === brand.name}
                  title="Delete brand"
                  className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 text-xs tracking-wide shadow-lg ${
          toast.type === "ok"
            ? "bg-[var(--foreground)] text-[var(--background)]"
            : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
