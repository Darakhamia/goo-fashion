"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { Product, Brand, Category, StyleKeyword } from "@/lib/types";

const BRANDS: Brand[] = [
  "Acne Studios", "Balenciaga", "Fear of God", "Toteme", "Lemaire",
  "The Row", "Jil Sander", "Maison Margiela", "A.P.C.", "Cos",
  "Arket", "Massimo Dutti", "Zara", "& Other Stories", "Nike",
];

const CATEGORIES: Category[] = [
  "outerwear", "tops", "bottoms", "footwear", "accessories", "dresses", "knitwear",
];

const STYLE_KEYWORDS: StyleKeyword[] = [
  "minimal", "streetwear", "classic", "avant-garde", "romantic",
  "utilitarian", "bohemian", "preppy", "sporty", "dark", "maximalist", "coastal", "academic",
];

interface ProductFormState {
  name: string;
  brand: Brand;
  category: Category;
  description: string;
  priceMin: string;
  priceMax: string;
  imageUrl: string;
  colors: string;
  sizes: string;
  material: string;
  styleKeywords: StyleKeyword[];
  isNew: boolean;
}

const defaultForm: ProductFormState = {
  name: "",
  brand: "Toteme",
  category: "outerwear",
  description: "",
  priceMin: "",
  priceMax: "",
  imageUrl: "",
  colors: "",
  sizes: "",
  material: "",
  styleKeywords: ["minimal"],
  isNew: false,
};

const inputClass =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";
const selectClass =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-[var(--background)] text-[var(--foreground)] transition-colors";
const labelClass = "block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5";

type ImportTab = "csv" | "json";

function parseCSV(text: string): Partial<Product>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());

    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });

    return {
      name: obj.name,
      brand: (obj.brand as Brand) || "Zara",
      category: (obj.category as Category) || "tops",
      description: obj.description || "",
      imageUrl: obj.imageurl || obj.image_url || obj.image || "",
      colors: obj.colors ? obj.colors.split("|").map((s) => s.trim()) : [],
      sizes: obj.sizes ? obj.sizes.split("|").map((s) => s.trim()) : [],
      material: obj.material || "",
      priceMin: parseFloat(obj.pricemin || obj.price_min || obj.price || "0") || 0,
      priceMax: parseFloat(obj.pricemax || obj.price_max || obj.price || "0") || 0,
      styleKeywords: ((obj.stylekeywords || obj.style_keywords)
        ? (obj.stylekeywords || obj.style_keywords).split("|").map((s) => s.trim() as StyleKeyword)
        : ["minimal" as StyleKeyword]),
      isNew: obj.isnew === "true" || obj.is_new === "true",
      isSaved: false,
      currency: "USD",
      images: obj.imageurl ? [obj.imageurl] : [],
      retailers: [],
    };
  }).filter((p) => !!p.name);
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(defaultForm);
  const [saving, setSaving] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>("csv");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<Partial<Product>[]>([]);
  const [importing, setImporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [importError, setImportError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);

      // Check DB status via seed endpoint (returns 501 if not configured)
      const testRes = await fetch("/api/products/seed", { method: "POST" });
      if (testRes.status === 501) {
        setDbConfigured(false);
      } else {
        setDbConfigured(true);
        const testJson = await testRes.json();
        if (testJson.inserted?.length) {
          const res2 = await fetch("/api/products");
          const d2 = await res2.json();
          setProducts(Array.isArray(d2) ? d2 : []);
        }
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setEditingProduct(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description ?? "",
      priceMin: String(product.priceMin),
      priceMax: String(product.priceMax),
      imageUrl: product.imageUrl ?? "",
      colors: product.colors?.join(", ") ?? "",
      sizes: product.sizes?.join(", ") ?? "",
      material: product.material ?? "",
      styleKeywords: (product.styleKeywords as StyleKeyword[]) ?? ["minimal"],
      isNew: product.isNew,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setForm(defaultForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: Partial<Product> = {
      name: form.name.trim(),
      brand: form.brand,
      category: form.category,
      description: form.description.trim(),
      priceMin: parseFloat(form.priceMin) || 0,
      priceMax: parseFloat(form.priceMax) || parseFloat(form.priceMin) || 0,
      imageUrl: form.imageUrl.trim() ||
        "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=800&q=90",
      images: form.imageUrl.trim() ? [form.imageUrl.trim()] : [],
      colors: form.colors.split(",").map((s) => s.trim()).filter(Boolean),
      sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
      material: form.material.trim(),
      styleKeywords: form.styleKeywords,
      isNew: form.isNew,
      isSaved: false,
      currency: "USD",
      retailers: [],
    };

    if (dbConfigured) {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : "/api/products";
      const method = editingProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Failed to save", "err");
        setSaving(false);
        return;
      }
      const saved = await res.json();
      if (editingProduct) {
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? saved : p)));
      } else {
        setProducts((prev) => [saved, ...prev]);
      }
      showToast(editingProduct ? "Product updated." : "Product added.");
    } else {
      if (editingProduct) {
        setProducts((prev) =>
          prev.map((p) => p.id === editingProduct.id ? { ...p, ...payload } : p)
        );
      } else {
        const newProduct: Product = {
          ...(payload as Product),
          id: `p-${Date.now()}`,
        };
        setProducts((prev) => [newProduct, ...prev]);
      }
      showToast("Saved in-memory. Configure Supabase to persist.");
    }
    setSaving(false);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    if (dbConfigured) {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) { showToast("Failed to delete", "err"); return; }
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast("Deleted.");
  };

  // ── Import ────────────────────────────────────────────────────────
  const parseImport = () => {
    setImportError("");
    try {
      if (importTab === "json") {
        const parsed = JSON.parse(importText);
        setImportPreview(Array.isArray(parsed) ? parsed : [parsed]);
      } else {
        const parsed = parseCSV(importText);
        if (parsed.length === 0) throw new Error("No valid rows found");
        setImportPreview(parsed);
      }
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Parse error");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText(ev.target?.result as string);
      setImportPreview([]);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importPreview.length) return;
    setImporting(true);
    if (dbConfigured) {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPreview),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Import failed", "err"); setImporting(false); return; }
      showToast(`Imported ${json.inserted?.length ?? 0} products.`);
      await fetchProducts();
    } else {
      const newProds: Product[] = importPreview.map((p, i) => ({
        id: `import-${Date.now()}-${i}`,
        name: p.name ?? "",
        brand: (p.brand as Brand) ?? "Zara",
        category: (p.category as Category) ?? "tops",
        description: p.description ?? "",
        imageUrl: p.imageUrl ?? "",
        images: p.images ?? [],
        colors: p.colors ?? [],
        sizes: p.sizes ?? [],
        material: p.material ?? "",
        retailers: [],
        priceMin: p.priceMin ?? 0,
        priceMax: p.priceMax ?? 0,
        currency: "USD",
        isNew: p.isNew ?? false,
        isSaved: false,
        styleKeywords: (p.styleKeywords ?? ["minimal"]) as Product["styleKeywords"],
      }));
      setProducts((prev) => [...newProds, ...prev]);
      showToast(`Imported ${newProds.length} products (in-memory).`);
    }
    setImporting(false);
    setShowImport(false);
    setImportText("");
    setImportPreview([]);
  };

  const handleSeed = async () => {
    setSeeding(true);
    const res = await fetch("/api/products/seed", { method: "POST" });
    const json = await res.json();
    if (!res.ok) { showToast(json.error || "Seed failed", "err"); setSeeding(false); return; }
    showToast(json.message);
    await fetchProducts();
    setSeeding(false);
  };

  const toggleKeyword = (kw: StyleKeyword) => {
    setForm((f) => ({
      ...f,
      styleKeywords: f.styleKeywords.includes(kw)
        ? f.styleKeywords.filter((k) => k !== kw)
        : [...f.styleKeywords, kw],
    }));
  };

  return (
    <div className="max-w-6xl">
      {/* DB status banner */}
      {dbConfigured === false && (
        <div className="mb-4 border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
          <strong>Database not configured.</strong> Products are in-memory only.
          Add <code className="font-mono">SUPABASE_URL</code> and{" "}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel env vars to persist.
        </div>
      )}
      {dbConfigured === true && (
        <div className="mb-4 border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
          Supabase connected — all changes are persisted to database.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Products</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
            {products.length} total &middot; {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSeed}
            disabled={seeding || !dbConfigured}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={dbConfigured ? "Seed default catalog" : "Requires Supabase"}
          >
            {seeding ? "Seeding…" : "Seed catalog"}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Import
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] px-4 py-2 text-xs tracking-[0.12em] uppercase transition-opacity hover:opacity-80"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="search"
          placeholder="Search by name, brand or category…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputClass} max-w-sm`}
        />
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] overflow-x-auto" style={{ background: "var(--background)" }}>
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal w-16">Image</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">Name</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden md:table-cell">Brand</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden lg:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">Price</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden sm:table-cell">New</th>
                <th className="text-right px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">No products found.</td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="relative w-10 h-[52px] overflow-hidden flex-shrink-0">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="w-full h-full bg-[var(--surface)]" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--foreground)]">{product.name}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-[var(--foreground-muted)]">{product.brand}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs tracking-[0.08em] uppercase text-[var(--foreground-subtle)]">{product.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--foreground)]">
                        ${product.priceMin}{product.priceMax !== product.priceMin ? `–$${product.priceMax}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {product.isNew ? (
                        <span className="text-[9px] tracking-[0.14em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-1.5 py-0.5 leading-none">New</span>
                      ) : (
                        <span className="text-[var(--foreground-subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditModal(product)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1" aria-label="Edit">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1" aria-label="Delete">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="border border-[var(--border)] p-8 max-w-xl w-full mx-4 max-h-[92vh] overflow-y-auto" style={{ background: "var(--background)" }}>
            <div className="flex items-center justify-between mb-7">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {editingProduct ? "Edit Product" : "Add Product"}
              </h2>
              <button onClick={closeModal} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass}>Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Product name" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Brand</label>
                  <select value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value as Brand }))} className={selectClass}>
                    {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))} className={selectClass}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short product description…" rows={3} className={`${inputClass} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Price Min ($)</label>
                  <input type="number" value={form.priceMin} onChange={(e) => setForm((f) => ({ ...f, priceMin: e.target.value }))} placeholder="0" min="0" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Price Max ($)</label>
                  <input type="number" value={form.priceMax} onChange={(e) => setForm((f) => ({ ...f, priceMax: e.target.value }))} placeholder="0" min="0" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Image URL</label>
                <input type="url" value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" className={inputClass} />
                {form.imageUrl && (
                  <div className="mt-2 relative w-16 h-20 border border-[var(--border)] overflow-hidden">
                    <Image src={form.imageUrl} alt="preview" fill className="object-cover" sizes="64px" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Colors <span className="normal-case text-[var(--foreground-subtle)]">(comma-sep)</span></label>
                  <input type="text" value={form.colors} onChange={(e) => setForm((f) => ({ ...f, colors: e.target.value }))} placeholder="Black, White, Camel" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Sizes <span className="normal-case text-[var(--foreground-subtle)]">(comma-sep)</span></label>
                  <input type="text" value={form.sizes} onChange={(e) => setForm((f) => ({ ...f, sizes: e.target.value }))} placeholder="XS, S, M, L, XL" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Material</label>
                <input type="text" value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} placeholder="100% Wool" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Style Keywords</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {STYLE_KEYWORDS.map((kw) => (
                    <button key={kw} type="button" onClick={() => toggleKeyword(kw)}
                      className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border transition-colors ${
                        form.styleKeywords.includes(kw)
                          ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="isNew" checked={form.isNew} onChange={(e) => setForm((f) => ({ ...f, isNew: e.target.checked }))} className="w-3.5 h-3.5 accent-[var(--foreground)]" />
                <label htmlFor="isNew" className="text-xs text-[var(--foreground-muted)] tracking-wide cursor-pointer">Mark as new arrival</label>
              </div>
            </div>

            <div className="flex gap-3 mt-7">
              <button onClick={handleSave} disabled={!form.name.trim() || saving}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-3 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : editingProduct ? "Save Changes" : "Add Product"}
              </button>
              <button onClick={closeModal} className="border border-[var(--border)] px-5 py-3 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="border border-[var(--border)] p-8 max-w-2xl w-full mx-4 max-h-[92vh] overflow-y-auto" style={{ background: "var(--background)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">Import Products</h2>
              <button onClick={() => { setShowImport(false); setImportText(""); setImportPreview([]); setImportError(""); }}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex border-b border-[var(--border)] mb-5">
              {(["csv", "json"] as ImportTab[]).map((tab) => (
                <button key={tab} onClick={() => { setImportTab(tab); setImportPreview([]); setImportError(""); }}
                  className={`px-4 py-2 text-xs tracking-[0.12em] uppercase border-b-2 transition-colors ${importTab === tab ? "border-[var(--foreground)] text-[var(--foreground)]" : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {importTab === "csv" && (
              <div className="mb-4">
                <p className="text-xs text-[var(--foreground-muted)] mb-3">
                  Columns: <code className="font-mono text-[10px]">name, brand, category, priceMin, priceMax, imageUrl, isNew, colors (pipe |), sizes (pipe |), description, material, styleKeywords (pipe |)</code>
                </p>
                <div className="mb-3">
                  <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => csvInputRef.current?.click()} className="border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                    Upload CSV file
                  </button>
                </div>
                <textarea value={importText} onChange={(e) => { setImportText(e.target.value); setImportPreview([]); }}
                  placeholder={"name,brand,category,priceMin,priceMax,imageUrl,isNew\nCool Jacket,Zara,outerwear,79,99,https://...,true"}
                  rows={8} className={`${inputClass} font-mono text-xs resize-none`}
                />
              </div>
            )}

            {importTab === "json" && (
              <div className="mb-4">
                <p className="text-xs text-[var(--foreground-muted)] mb-3">Paste a JSON array of product objects.</p>
                <textarea value={importText} onChange={(e) => { setImportText(e.target.value); setImportPreview([]); }}
                  placeholder={'[\n  {\n    "name": "Cool Jacket",\n    "brand": "Zara",\n    "category": "outerwear",\n    "priceMin": 79,\n    "priceMax": 99\n  }\n]'}
                  rows={10} className={`${inputClass} font-mono text-xs resize-none`}
                />
              </div>
            )}

            {importError && <p className="text-xs text-red-500 mb-3">{importError}</p>}

            {importPreview.length > 0 && (
              <div className="mb-4 border border-[var(--border)] max-h-44 overflow-y-auto">
                <p className="px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)] border-b border-[var(--border)]">
                  {importPreview.length} products to import
                </p>
                {importPreview.map((p, i) => (
                  <div key={i} className="px-3 py-2 text-xs text-[var(--foreground)] border-b border-[var(--border)] last:border-b-0 flex items-center justify-between gap-4">
                    <span className="font-medium truncate">{p.name || "—"}</span>
                    <span className="text-[var(--foreground-muted)] shrink-0">{p.brand} · {p.category} · ${p.priceMin}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={parseImport} className="border border-[var(--border)] px-4 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                Preview
              </button>
              <button onClick={handleImport} disabled={!importPreview.length || importing}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-2.5 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {importing ? "Importing…" : `Import ${importPreview.length ? importPreview.length + " " : ""}Products`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 text-sm border ${
          toast.type === "ok"
            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
            : "border-red-400 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
