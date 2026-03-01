"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { Product, Category, StyleKeyword, Retailer, Gender } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────────────────

const SUGGESTED_BRANDS = [
  "Acne Studios", "Arket", "& Other Stories", "A.P.C.", "Balenciaga",
  "Bottega Veneta", "Burberry", "Cos", "Fear of God", "Gucci",
  "Jacquemus", "Jil Sander", "Lemaire", "Louis Vuitton", "Maison Margiela",
  "Massimo Dutti", "Miu Miu", "Nike", "Prada", "Sandro", "The Row",
  "Toteme", "Valentino", "Zara",
];

const CATEGORIES: Category[] = [
  "outerwear", "tops", "bottoms", "footwear", "accessories", "dresses", "knitwear",
];

const STYLE_KEYWORDS: StyleKeyword[] = [
  "minimal", "streetwear", "classic", "avant-garde", "romantic",
  "utilitarian", "bohemian", "preppy", "sporty", "dark", "maximalist", "coastal", "academic",
];

const AVAILABILITY_OPTIONS = ["in stock", "low stock", "sold out"] as const;

// ── Types ──────────────────────────────────────────────────────────────────────

interface RetailerForm {
  name: string;
  url: string;
  price: string;
  availability: "in stock" | "low stock" | "sold out";
  isOfficial: boolean;
}

interface ProductFormState {
  name: string;
  brand: string;
  category: Category;
  gender: Gender | "";
  description: string;
  priceMin: string;
  priceMax: string;
  images: string[];
  colorsRaw: string;
  colorImages: Record<string, string[]>;
  sizes: string;
  material: string;
  styleKeywords: StyleKeyword[];
  retailers: RetailerForm[];
  isNew: boolean;
}

const defaultForm: ProductFormState = {
  name: "",
  brand: "",
  category: "outerwear",
  gender: "",
  description: "",
  priceMin: "",
  priceMax: "",
  images: [""],
  colorsRaw: "",
  colorImages: {},
  sizes: "",
  material: "",
  styleKeywords: ["minimal"],
  retailers: [],
  isNew: false,
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const inputCls =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";
const selectCls =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-[var(--background)] text-[var(--foreground)] transition-colors";
const labelCls =
  "block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5";
const sectionCls = "border-t border-[var(--border)] pt-4 mt-1";

// ── CSV Parser ─────────────────────────────────────────────────────────────────

type ImportTab = "csv" | "json";

function parseCSV(text: string): Partial<Product>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { values.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = values[i] ?? ""; });
    return {
      name: o.name,
      brand: o.brand as Product["brand"] || "Zara" as Product["brand"],
      category: (o.category as Category) || "tops",
      description: o.description || "",
      imageUrl: o.imageurl || o.image_url || o.image || "",
      images: o.imageurl ? [o.imageurl] : [],
      colors: o.colors ? o.colors.split("|").map((s) => s.trim()) : [],
      sizes: o.sizes ? o.sizes.split("|").map((s) => s.trim()) : [],
      material: o.material || "",
      priceMin: parseFloat(o.pricemin || o.price_min || o.price || "0") || 0,
      priceMax: parseFloat(o.pricemax || o.price_max || o.price || "0") || 0,
      styleKeywords: ((o.stylekeywords || o.style_keywords)
        ? (o.stylekeywords || o.style_keywords).split("|").map((s) => s.trim() as StyleKeyword)
        : ["minimal" as StyleKeyword]) as StyleKeyword[],
      isNew: o.isnew === "true" || o.is_new === "true",
      isSaved: false,
      currency: "USD",
      retailers: [],
    };
  }).filter((p) => !!p.name);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveColors(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ImageList({
  images,
  onChange,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
}) {
  const addRow = () => onChange([...images, ""]);
  const removeRow = (i: number) => onChange(images.filter((_, idx) => idx !== i));
  const setVal = (i: number, v: string) =>
    onChange(images.map((img, idx) => (idx === i ? v : img)));

  return (
    <div className="flex flex-col gap-2">
      {images.map((url, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 flex flex-col gap-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setVal(i, e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
            {url && (
              <div className="relative w-12 h-16 border border-[var(--border)] overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                />
              </div>
            )}
          </div>
          {i === 0 && (
            <span className="text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] mt-2.5 shrink-0">Main</span>
          )}
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="mt-2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="self-start text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5 mt-1"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Add image
      </button>
    </div>
  );
}

function ColorImageSection({
  colorsRaw,
  colorImages,
  onChange,
}: {
  colorsRaw: string;
  colorImages: Record<string, string[]>;
  onChange: (ci: Record<string, string[]>) => void;
}) {
  const colors = deriveColors(colorsRaw);
  if (colors.length === 0) return null;

  const setColorImgs = (color: string, imgs: string[]) =>
    onChange({ ...colorImages, [color]: imgs });

  return (
    <div className="flex flex-col gap-4 mt-3">
      {colors.map((color) => {
        const imgs = colorImages[color] ?? [""];
        return (
          <div key={color}>
            <p className={`${labelCls} mb-2`}>
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--foreground)] mr-1.5 align-middle" />
              {color}
            </p>
            <ImageList
              images={imgs}
              onChange={(next) => setColorImgs(color, next)}
            />
          </div>
        );
      })}
    </div>
  );
}

function RetailerList({
  retailers,
  onChange,
}: {
  retailers: RetailerForm[];
  onChange: (r: RetailerForm[]) => void;
}) {
  const add = () =>
    onChange([...retailers, { name: "", url: "", price: "", availability: "in stock", isOfficial: false }]);
  const remove = (i: number) => onChange(retailers.filter((_, idx) => idx !== i));
  const set = (i: number, patch: Partial<RetailerForm>) =>
    onChange(retailers.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-3">
      {retailers.map((r, i) => (
        <div key={i} className="border border-[var(--border)] p-3 flex flex-col gap-2 relative">
          <button
            type="button"
            onClick={() => remove(i)}
            className="absolute top-2 right-2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="grid grid-cols-2 gap-2 pr-5">
            <div>
              <label className={labelCls}>Store name</label>
              <input
                type="text"
                value={r.name}
                onChange={(e) => set(i, { name: e.target.value })}
                placeholder="Zara Official"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Price ($)</label>
              <input
                type="number"
                value={r.price}
                onChange={(e) => set(i, { price: e.target.value })}
                placeholder="99"
                min="0"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Store URL</label>
            <input
              type="url"
              value={r.url}
              onChange={(e) => set(i, { url: e.target.value })}
              placeholder="https://zara.com/product/…"
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className={labelCls}>Availability</label>
              <select
                value={r.availability}
                onChange={(e) => set(i, { availability: e.target.value as RetailerForm["availability"] })}
                className={selectCls}
              >
                {AVAILABILITY_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id={`official-${i}`}
                checked={r.isOfficial}
                onChange={(e) => set(i, { isOfficial: e.target.checked })}
                className="w-3.5 h-3.5 accent-[var(--foreground)]"
              />
              <label htmlFor={`official-${i}`} className="text-xs text-[var(--foreground-muted)] cursor-pointer">
                Official store
              </label>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Add retailer
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

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

  const [filterCategory, setFilterCategory] = useState<Category | "">("");
  const [filterNew, setFilterNew] = useState<boolean | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "brand" | "category" | "priceMin" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Check if Supabase is configured (GET = read-only, no auto-seeding)
      const configRes = await fetch("/api/products/seed");
      setDbConfigured(configRes.status !== 501);

      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filterCategory) list = list.filter((p) => p.category === filterCategory);
    if (filterNew !== null) list = list.filter((p) => p.isNew === filterNew);
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const va = (sortKey === "priceMin" ? a.priceMin : a[sortKey as "name" | "brand" | "category"]) ?? "";
        const vb = (sortKey === "priceMin" ? b.priceMin : b[sortKey as "name" | "brand" | "category"]) ?? "";
        const cmp = typeof va === "number"
          ? (va as number) - (vb as number)
          : String(va).toLowerCase().localeCompare(String(vb).toLowerCase());
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [products, searchQuery, filterCategory, filterNew, sortKey, sortDir]);

  // ── Modal ──────────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingProduct(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    // Merge color images: ensure every known color has at least an empty entry
    const ci: Record<string, string[]> = { ...(product.colorImages ?? {}) };
    setForm({
      name: product.name,
      brand: product.brand,
      category: product.category,
      gender: (product.gender ?? "") as Gender | "",
      description: product.description ?? "",
      priceMin: String(product.priceMin),
      priceMax: String(product.priceMax),
      images: product.images?.length ? product.images : [product.imageUrl ?? ""],
      colorsRaw: product.colors?.join(", ") ?? "",
      colorImages: ci,
      sizes: product.sizes?.join(", ") ?? "",
      material: product.material ?? "",
      styleKeywords: (product.styleKeywords as StyleKeyword[]) ?? ["minimal"],
      retailers: (product.retailers ?? []).map((r) => ({
        name: r.name,
        url: r.url,
        price: String(r.price),
        availability: r.availability,
        isOfficial: r.isOfficial,
      })),
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

    const validImages = form.images.filter((u) => u.trim());
    const colors = deriveColors(form.colorsRaw);
    const cleanColorImages: Record<string, string[]> = {};
    colors.forEach((c) => {
      const imgs = (form.colorImages[c] ?? []).filter((u) => u.trim());
      if (imgs.length) cleanColorImages[c] = imgs;
    });

    const payload: Partial<Product> = {
      name: form.name.trim(),
      brand: form.brand as Product["brand"],
      category: form.category,
      gender: form.gender ? (form.gender as Gender) : undefined,
      description: form.description.trim(),
      priceMin: parseFloat(form.priceMin) || 0,
      priceMax: parseFloat(form.priceMax) || parseFloat(form.priceMin) || 0,
      imageUrl: validImages[0] || "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=800&q=90",
      images: validImages.length ? validImages : ["https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=800&q=90"],
      colors,
      colorImages: Object.keys(cleanColorImages).length ? cleanColorImages : undefined,
      sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
      material: form.material.trim(),
      styleKeywords: form.styleKeywords,
      retailers: form.retailers.map((r) => ({
        name: r.name,
        url: r.url,
        price: parseFloat(r.price) || 0,
        currency: "USD",
        availability: r.availability,
        isOfficial: r.isOfficial,
      })) as Retailer[],
      isNew: form.isNew,
      isSaved: false,
      currency: "USD",
    };

    if (dbConfigured) {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
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

  // ── Import ─────────────────────────────────────────────────────────────────

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
    reader.onload = (ev) => { setImportText(ev.target?.result as string); setImportPreview([]); };
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
        brand: (p.brand as Product["brand"]) ?? "Zara" as Product["brand"],
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

  // ── Sort / select helpers ───────────────────────────────────────────────────

  const toggleSort = (key: "name" | "brand" | "category" | "priceMin") => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} selected product${count > 1 ? "s" : ""}?`)) return;
    const ids = [...selectedIds];
    if (dbConfigured) {
      await Promise.all(ids.map((id) => fetch(`/api/products/${id}`, { method: "DELETE" })));
    }
    setProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
    setSelectedIds(new Set());
    showToast(`Deleted ${count} product${count > 1 ? "s" : ""}.`);
  };

  // Sort arrow helper
  const SortIcon = ({ col }: { col: "name" | "brand" | "category" | "priceMin" }) => (
    <span className="inline-flex flex-col ml-1 gap-[1px] opacity-50 group-hover:opacity-100">
      <span className={`block w-0 h-0 border-x-[3px] border-x-transparent border-b-[4px] ${sortKey === col && sortDir === "asc" ? "border-b-[var(--foreground)] opacity-100" : "border-b-[var(--foreground-muted)]"}`} />
      <span className={`block w-0 h-0 border-x-[3px] border-x-transparent border-t-[4px] ${sortKey === col && sortDir === "desc" ? "border-t-[var(--foreground)] opacity-100" : "border-t-[var(--foreground-muted)]"}`} />
    </span>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
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
            title={dbConfigured ? "Seed default catalog" : "Requires Supabase"}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* Search + Filters */}
      <div className="mb-5 flex flex-col gap-3">
        <input
          type="search"
          placeholder="Search by name, brand or category…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputCls} max-w-sm`}
        />

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mr-1">Filter:</span>

          {/* Category chips */}
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory((prev) => (prev === cat ? "" : cat))}
              className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border transition-colors ${
                filterCategory === cat
                  ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {cat}
            </button>
          ))}

          {/* Divider */}
          <span className="w-px h-4 bg-[var(--border)]" />

          {/* New chip */}
          <button
            onClick={() => setFilterNew((prev) => (prev === true ? null : true))}
            className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border transition-colors ${
              filterNew === true
                ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            New only
          </button>

          {/* Clear filters */}
          {(filterCategory || filterNew !== null || sortKey) && (
            <button
              onClick={() => { setFilterCategory(""); setFilterNew(null); setSortKey(null); }}
              className="ml-1 text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="mb-3 flex items-center gap-3 border border-[var(--border)] px-4 py-2.5 bg-[var(--surface)]">
          <span className="text-xs text-[var(--foreground)]">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase border border-red-400 text-red-500 dark:text-red-400 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 3h10M4 3V2h4v1M5 5.5v3M7 5.5v3M2 3l.7 7.3A1 1 0 003.7 11h4.6a1 1 0 001-.7L10 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Delete {selectedIds.size}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors ml-auto"
          >
            Deselect all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-[var(--border)] overflow-x-auto" style={{ background: "var(--background)" }}>
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {/* Checkbox */}
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer"
                    title="Select all"
                  />
                </th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal w-16">Image</th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                  <button onClick={() => toggleSort("name")} className="group inline-flex items-center gap-0.5 hover:text-[var(--foreground)] transition-colors">
                    Name <SortIcon col="name" />
                  </button>
                </th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden md:table-cell">
                  <button onClick={() => toggleSort("brand")} className="group inline-flex items-center gap-0.5 hover:text-[var(--foreground)] transition-colors">
                    Brand <SortIcon col="brand" />
                  </button>
                </th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden lg:table-cell">
                  <button onClick={() => toggleSort("category")} className="group inline-flex items-center gap-0.5 hover:text-[var(--foreground)] transition-colors">
                    Category <SortIcon col="category" />
                  </button>
                </th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                  <button onClick={() => toggleSort("priceMin")} className="group inline-flex items-center gap-0.5 hover:text-[var(--foreground)] transition-colors">
                    Price <SortIcon col="priceMin" />
                  </button>
                </th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden sm:table-cell">New</th>
                <th className="text-right px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
                    No products found.
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-b border-[var(--border)] last:border-b-0 transition-colors ${
                      selectedIds.has(product.id) ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative w-10 h-[52px] overflow-hidden">
                        {product.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[var(--surface)]" />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <span className="text-sm text-[var(--foreground)]">{product.name}</span>
                    </td>
                    <td className="px-2 py-3 hidden md:table-cell">
                      <span className="text-sm text-[var(--foreground-muted)]">{product.brand}</span>
                    </td>
                    <td className="px-2 py-3 hidden lg:table-cell">
                      <span className="text-xs tracking-[0.08em] uppercase text-[var(--foreground-subtle)]">{product.category}</span>
                    </td>
                    <td className="px-2 py-3">
                      <span className="text-sm text-[var(--foreground)]">
                        ${product.priceMin}{product.priceMax !== product.priceMin ? `–$${product.priceMax}` : ""}
                      </span>
                    </td>
                    <td className="px-2 py-3 hidden sm:table-cell">
                      {product.isNew ? (
                        <span className="text-[9px] tracking-[0.14em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-1.5 py-0.5">New</span>
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
          <div
            className="border border-[var(--border)] p-6 md:p-8 max-w-4xl w-full mx-4 max-h-[92vh] overflow-y-auto"
            style={{ background: "var(--background)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {editingProduct ? "Edit Product" : "Add Product"}
              </h2>
              <button onClick={closeModal} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {/* ── Two-column layout: left = info, right = images + variants ── */}
              <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:gap-8">

                {/* Left column */}
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls}>Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Product name"
                      className={inputCls}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Brand</label>
                      <input
                        type="text"
                        list="brand-suggestions"
                        value={form.brand}
                        onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                        placeholder="Type or pick brand…"
                        className={inputCls}
                      />
                      <datalist id="brand-suggestions">
                        {SUGGESTED_BRANDS.map((b) => <option key={b} value={b} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className={labelCls}>Category</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                        className={selectCls}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Gender</label>
                      <select
                        value={form.gender}
                        onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender | "" }))}
                        className={selectCls}
                      >
                        <option value="">Unspecified</option>
                        <option value="women">Women</option>
                        <option value="men">Men</option>
                        <option value="unisex">Unisex</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Material</label>
                      <input
                        type="text"
                        value={form.material}
                        onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                        placeholder="100% Wool"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Short product description…"
                      rows={3}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Price Min ($)</label>
                      <input
                        type="number"
                        value={form.priceMin}
                        onChange={(e) => setForm((f) => ({ ...f, priceMin: e.target.value }))}
                        placeholder="0"
                        min="0"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Price Max ($)</label>
                      <input
                        type="number"
                        value={form.priceMax}
                        onChange={(e) => setForm((f) => ({ ...f, priceMax: e.target.value }))}
                        placeholder="0"
                        min="0"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="checkbox"
                      id="isNew"
                      checked={form.isNew}
                      onChange={(e) => setForm((f) => ({ ...f, isNew: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-[var(--foreground)]"
                    />
                    <label htmlFor="isNew" className="text-xs text-[var(--foreground-muted)] tracking-wide cursor-pointer">
                      Mark as new arrival
                    </label>
                  </div>
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-5">
                  {/* Images */}
                  <div>
                    <label className={`${labelCls} mb-3`}>
                      Images <span className="normal-case text-[var(--foreground-subtle)]">(first = main)</span>
                    </label>
                    <ImageList
                      images={form.images}
                      onChange={(imgs) => setForm((f) => ({ ...f, images: imgs }))}
                    />
                  </div>

                  {/* Colors + Sizes */}
                  <div className="border-t border-[var(--border)] pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Colors <span className="normal-case text-[var(--foreground-subtle)]">(comma-sep)</span></label>
                        <input
                          type="text"
                          value={form.colorsRaw}
                          onChange={(e) => setForm((f) => ({ ...f, colorsRaw: e.target.value }))}
                          placeholder="Black, White, Camel"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Sizes <span className="normal-case text-[var(--foreground-subtle)]">(comma-sep)</span></label>
                        <input
                          type="text"
                          value={form.sizes}
                          onChange={(e) => setForm((f) => ({ ...f, sizes: e.target.value }))}
                          placeholder="XS, S, M, L, XL"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    {/* Color-specific images */}
                    {deriveColors(form.colorsRaw).length > 0 && (
                      <div className="mt-4">
                        <label className={`${labelCls} mb-1`}>
                          Images per color <span className="normal-case text-[var(--foreground-subtle)]">(optional)</span>
                        </label>
                        <ColorImageSection
                          colorsRaw={form.colorsRaw}
                          colorImages={form.colorImages}
                          onChange={(ci) => setForm((f) => ({ ...f, colorImages: ci }))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Full-width: Style Keywords ── */}
              <div className="border-t border-[var(--border)] pt-5">
                <label className={labelCls}>Style Keywords</label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {STYLE_KEYWORDS.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => toggleKeyword(kw)}
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

              {/* ── Full-width: Retailers ── */}
              <div className="border-t border-[var(--border)] pt-5">
                <label className={`${labelCls} mb-3`}>Where to buy</label>
                <RetailerList
                  retailers={form.retailers}
                  onChange={(r) => setForm((f) => ({ ...f, retailers: r }))}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-7">
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-3 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : editingProduct ? "Save Changes" : "Add Product"}
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

      {/* ── Import Modal ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="border border-[var(--border)] p-8 max-w-2xl w-full mx-4 max-h-[92vh] overflow-y-auto"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">Import Products</h2>
              <button
                onClick={() => { setShowImport(false); setImportText(""); setImportPreview([]); setImportError(""); }}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex border-b border-[var(--border)] mb-5">
              {(["csv", "json"] as ImportTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setImportTab(tab); setImportPreview([]); setImportError(""); }}
                  className={`px-4 py-2 text-xs tracking-[0.12em] uppercase border-b-2 transition-colors ${
                    importTab === tab
                      ? "border-[var(--foreground)] text-[var(--foreground)]"
                      : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {importTab === "csv" && (
              <div className="mb-4">
                <p className="text-xs text-[var(--foreground-muted)] mb-3">
                  Columns: <code className="font-mono text-[10px]">name, brand, category, priceMin, priceMax, imageUrl, isNew, colors (|), sizes (|), description, material, styleKeywords (|)</code>
                </p>
                <div className="mb-3">
                  <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
                  >
                    Upload CSV file
                  </button>
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportPreview([]); }}
                  placeholder={"name,brand,category,priceMin,priceMax,imageUrl,isNew\nCool Jacket,Zara,outerwear,79,99,https://...,true"}
                  rows={8}
                  className={`${inputCls} font-mono text-xs resize-none`}
                />
              </div>
            )}

            {importTab === "json" && (
              <div className="mb-4">
                <p className="text-xs text-[var(--foreground-muted)] mb-3">Paste a JSON array of product objects.</p>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportPreview([]); }}
                  placeholder={'[\n  { "name": "Cool Jacket", "brand": "Zara", "category": "outerwear", "priceMin": 79, "priceMax": 99 }\n]'}
                  rows={10}
                  className={`${inputCls} font-mono text-xs resize-none`}
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
              <button
                onClick={parseImport}
                className="border border-[var(--border)] px-4 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                Preview
              </button>
              <button
                onClick={handleImport}
                disabled={!importPreview.length || importing}
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
        <div
          className={`fixed bottom-6 right-6 z-[100] px-5 py-3 text-sm border ${
            toast.type === "ok"
              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
              : "border-red-400 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
