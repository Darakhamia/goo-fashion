"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { outfits as staticOutfits } from "@/lib/data/outfits";
import type { Outfit, Product, Occasion, StyleKeyword, Category } from "@/lib/types";

type OutfitRole = "hero" | "secondary" | "accent";
type Season = "all" | "spring" | "summer" | "autumn" | "winter";

interface SelectedItem {
  product: Product;
  role: OutfitRole;
}

interface OutfitFormState {
  name: string;
  occasion: Occasion;
  season: Season;
  description: string;
  imageUrl: string;
  styleKeywords: StyleKeyword[];
  isAIGenerated: boolean;
}

const OCCASIONS: Occasion[] = ["casual", "work", "evening", "sport", "formal", "weekend"];
const SEASONS: Season[] = ["all", "spring", "summer", "autumn", "winter"];
const CATEGORIES: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "outerwear", label: "Outerwear" },
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "dresses", label: "Dresses" },
  { value: "knitwear", label: "Knitwear" },
  { value: "footwear", label: "Footwear" },
  { value: "accessories", label: "Accessories" },
];
const STYLE_KEYWORDS: StyleKeyword[] = [
  "minimal","streetwear","classic","avant-garde","romantic",
  "utilitarian","bohemian","preppy","sporty","dark","maximalist","coastal","academic",
];
const ROLES: OutfitRole[] = ["hero", "secondary", "accent"];

const defaultForm: OutfitFormState = {
  name: "",
  occasion: "casual",
  season: "all",
  description: "",
  imageUrl: "",
  styleKeywords: [],
  isAIGenerated: false,
};

const inputCls =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";
const selectCls =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-[var(--background)] text-[var(--foreground)] transition-colors";
const labelCls = "block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5";

export default function AdminOutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OutfitFormState>(defaultForm);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState<Category | "all">("all");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Load outfits on mount
  useEffect(() => {
    fetch("/api/outfits")
      .then((r) => r.json())
      .then((data) => {
        setOutfits(Array.isArray(data) ? data : staticOutfits);
      })
      .catch(() => setOutfits(staticOutfits))
      .finally(() => setLoading(false));
  }, []);

  // Load products when modal opens
  const loadProducts = useCallback(() => {
    if (products.length > 0) return;
    setLoadingProducts(true);
    fetch("/api/products?raw=true")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [products.length]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(defaultForm);
    setSelectedItems([]);
    setSaveError("");
    setUploadError("");
    setProductSearch("");
    setProductCategory("all");
    setShowModal(true);
    loadProducts();
  };

  const openEditModal = (outfit: Outfit) => {
    setEditingId(outfit.id);
    setForm({
      name: outfit.name,
      occasion: outfit.occasion,
      season: outfit.season,
      description: outfit.description,
      imageUrl: outfit.imageUrl,
      styleKeywords: outfit.styleKeywords,
      isAIGenerated: outfit.isAIGenerated,
    });
    setSelectedItems(outfit.items.map((i) => ({ product: i.product, role: i.role })));
    setSaveError("");
    setUploadError("");
    setProductSearch("");
    setProductCategory("all");
    setShowModal(true);
    loadProducts();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "Upload failed");
      } else {
        setForm((f) => ({ ...f, imageUrl: json.url }));
      }
    } catch {
      setUploadError("Network error during upload");
    } finally {
      setUploading(false);
    }
  };

  // Price auto-calculated from selected items
  const priceMin = selectedItems.reduce((s, i) => s + i.product.priceMin, 0);
  const priceMax = selectedItems.reduce((s, i) => s + i.product.priceMax, 0);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError("");

    const body = {
      ...form,
      items: selectedItems.map((i) => ({ productId: i.product.id, role: i.role })),
      totalPriceMin: priceMin,
      totalPriceMax: priceMax,
      currency: "USD",
    };

    try {
      const url = editingId ? `/api/outfits/${editingId}` : "/api/outfits";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // If DB not configured (501), save locally
        if (res.status === 501) {
          saveLocally(body);
        } else {
          setSaveError(err.error ?? "Failed to save.");
        }
        return;
      }

      const saved: Outfit = await res.json();
      if (editingId) {
        setOutfits((prev) => prev.map((o) => (o.id === editingId ? saved : o)));
      } else {
        setOutfits((prev) => [saved, ...prev]);
      }
      closeModal();
    } catch {
      // Network error — save locally
      saveLocally(body);
    } finally {
      setSaving(false);
    }
  };

  const saveLocally = (body: typeof defaultForm & { items: { productId: string; role: OutfitRole }[]; totalPriceMin: number; totalPriceMax: number; currency: string }) => {
    const hydratedItems = body.items.map((i) => {
      const p = products.find((p) => p.id === i.productId);
      return p ? { product: p, role: i.role } : null;
    }).filter(Boolean) as SelectedItem[];

    if (editingId) {
      setOutfits((prev) =>
        prev.map((o) =>
          o.id === editingId
            ? { ...o, ...body, items: hydratedItems, totalPriceMin: body.totalPriceMin, totalPriceMax: body.totalPriceMax }
            : o
        )
      );
    } else {
      const newOutfit: Outfit = {
        id: `o-${Date.now()}`,
        name: body.name,
        occasion: body.occasion,
        season: body.season,
        description: body.description,
        imageUrl: body.imageUrl || "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=90",
        items: hydratedItems,
        totalPriceMin: body.totalPriceMin,
        totalPriceMax: body.totalPriceMax,
        currency: "USD",
        styleKeywords: body.styleKeywords,
        isAIGenerated: body.isAIGenerated,
        isSaved: false,
      };
      setOutfits((prev) => [newOutfit, ...prev]);
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    try {
      const res = await fetch(`/api/outfits/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 501) {
        setOutfits((prev) => prev.filter((o) => o.id !== id));
      }
    } catch {
      setOutfits((prev) => prev.filter((o) => o.id !== id));
    } finally {
      setDeleteId(null);
    }
  };

  const toggleItem = (product: Product) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.product.id === product.id);
      if (exists) return prev.filter((i) => i.product.id !== product.id);
      const role: OutfitRole =
        prev.length === 0 ? "hero" : prev.length === 1 ? "secondary" : "accent";
      return [...prev, { product, role }];
    });
  };

  const setRole = (productId: string, role: OutfitRole) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, role } : i))
    );
  };

  const removeItem = (productId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const toggleKeyword = (kw: StyleKeyword) => {
    setForm((f) => ({
      ...f,
      styleKeywords: f.styleKeywords.includes(kw)
        ? f.styleKeywords.filter((k) => k !== kw)
        : [...f.styleKeywords, kw],
    }));
  };

  // Filtered products for the picker
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.brand.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = productCategory === "all" || p.category === productCategory;
    return matchesSearch && matchesCategory;
  });

  // Filtered outfits in table
  const filteredOutfits = outfits.filter(
    (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.occasion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Outfits</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
            {loading ? "Loading..." : `${outfits.length} total · ${filteredOutfits.length} shown`}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 text-xs tracking-[0.12em] uppercase transition-opacity hover:opacity-80"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Add Outfit
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="search"
          placeholder="Search by name, occasion or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputCls} max-w-sm`}
        />
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] overflow-x-auto" style={{ background: "var(--background)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Image", "Name", "Occasion", "Season", "Items", "Price Range", "Keywords", "Actions"].map((h, i) => (
                <th
                  key={h}
                  className={`text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal${
                    i === 7 ? " text-right" : ""
                  }${i >= 3 && i <= 6 ? " hidden lg:table-cell" : ""}${i === 2 ? " hidden md:table-cell" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
                  Loading...
                </td>
              </tr>
            ) : filteredOutfits.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
                  No outfits found.
                </td>
              </tr>
            ) : (
              filteredOutfits.map((outfit) => (
                <tr
                  key={outfit.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors"
                >
                  {/* Image */}
                  <td className="px-4 py-3">
                    <div className="relative w-10 h-[52px] overflow-hidden flex-shrink-0">
                      <Image src={outfit.imageUrl} alt={outfit.name} fill className="object-cover" sizes="40px" />
                    </div>
                  </td>
                  {/* Name */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">{outfit.name}</span>
                  </td>
                  {/* Occasion */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs tracking-[0.08em] uppercase text-[var(--foreground-muted)]">
                      {outfit.occasion}
                    </span>
                  </td>
                  {/* Season */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs tracking-[0.08em] uppercase text-[var(--foreground-muted)]">
                      {outfit.season}
                    </span>
                  </td>
                  {/* Items */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-2">
                        {outfit.items.slice(0, 3).map((item) => (
                          <div
                            key={item.product.id}
                            className="relative w-6 h-6 rounded-full overflow-hidden border border-[var(--background)] flex-shrink-0"
                          >
                            <Image
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                              sizes="24px"
                            />
                          </div>
                        ))}
                      </div>
                      <span className="text-xs text-[var(--foreground-muted)]">
                        {outfit.items.length} {outfit.items.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </td>
                  {/* Price */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">
                      ${outfit.totalPriceMin}–${outfit.totalPriceMax}
                    </span>
                  </td>
                  {/* Keywords */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {outfit.styleKeywords.slice(0, 2).map((kw) => (
                        <span
                          key={kw}
                          className="text-[9px] tracking-[0.1em] uppercase border border-[var(--border)] text-[var(--foreground-subtle)] px-1.5 py-0.5 leading-none"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(outfit)}
                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1"
                        aria-label="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(outfit.id)}
                        disabled={deleteId === outfit.id}
                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1 disabled:opacity-40"
                        aria-label="Delete"
                      >
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
      </div>

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-6 px-4">
          <div
            className="border border-[var(--border)] w-full max-w-5xl flex flex-col"
            style={{ background: "var(--background)" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {editingId ? "Edit Outfit" : "New Outfit"}
              </h2>
              <button
                onClick={closeModal}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Modal body: two columns */}
            <div className="flex flex-col lg:flex-row min-h-0">

              {/* ── LEFT: Product picker ── */}
              <div className="lg:w-[55%] border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col">
                <div className="px-5 py-4 border-b border-[var(--border)]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)] mb-3">
                    Products — select items for this outfit
                  </p>
                  {/* Search */}
                  <input
                    type="search"
                    placeholder="Search by name or brand..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className={inputCls}
                  />
                  {/* Category filter */}
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {CATEGORIES.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setProductCategory(value)}
                        className={`text-[9px] uppercase tracking-[0.1em] px-2.5 py-1 border transition-colors ${
                          productCategory === value
                            ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                            : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product grid */}
                <div className="overflow-y-auto flex-1 p-4" style={{ maxHeight: "420px" }}>
                  {loadingProducts ? (
                    <p className="text-xs text-[var(--foreground-subtle)] text-center py-8">Loading products...</p>
                  ) : filteredProducts.length === 0 ? (
                    <p className="text-xs text-[var(--foreground-subtle)] text-center py-8">No products found.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {filteredProducts.map((product) => {
                        const isSelected = selectedItems.some((i) => i.product.id === product.id);
                        return (
                          <button
                            key={product.id}
                            onClick={() => toggleItem(product)}
                            className={`text-left border transition-all group relative ${
                              isSelected
                                ? "border-[var(--foreground)] bg-[var(--surface)]"
                                : "border-[var(--border)] hover:border-[var(--foreground)]"
                            }`}
                          >
                            {/* Product image */}
                            <div className="relative w-full aspect-[3/4] overflow-hidden bg-[var(--surface)]">
                              <Image
                                src={product.imageUrl}
                                alt={product.name}
                                fill
                                className="object-cover transition-transform group-hover:scale-105"
                                sizes="(max-width: 640px) 45vw, 160px"
                              />
                              {/* Selected overlay */}
                              {isSelected && (
                                <div className="absolute inset-0 bg-[var(--foreground)]/20 flex items-center justify-center">
                                  <div className="w-6 h-6 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Product info */}
                            <div className="p-2">
                              <p className="text-[10px] text-[var(--foreground-muted)] truncate">{product.brand}</p>
                              <p className="text-xs text-[var(--foreground)] leading-snug line-clamp-2">{product.name}</p>
                              <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">${product.priceMin}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT: Outfit composer ── */}
              <div className="lg:w-[45%] flex flex-col overflow-y-auto" style={{ maxHeight: "600px" }}>
                <div className="px-5 py-4 flex flex-col gap-4">

                  {/* Selected items */}
                  <div>
                    <p className={labelCls}>
                      Selected items ({selectedItems.length}/4)
                    </p>
                    {selectedItems.length === 0 ? (
                      <p className="text-xs text-[var(--foreground-subtle)] border border-dashed border-[var(--border)] px-3 py-4 text-center">
                        Click products on the left to add them
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {selectedItems.map((item) => (
                          <div
                            key={item.product.id}
                            className="flex items-center gap-3 border border-[var(--border)] p-2"
                          >
                            <div className="relative w-10 h-12 flex-shrink-0 overflow-hidden">
                              <Image
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[var(--foreground)] truncate">{item.product.name}</p>
                              <p className="text-[10px] text-[var(--foreground-muted)]">{item.product.brand} · ${item.product.priceMin}</p>
                            </div>
                            {/* Role */}
                            <select
                              value={item.role}
                              onChange={(e) => setRole(item.product.id, e.target.value as OutfitRole)}
                              className="text-[10px] uppercase tracking-[0.08em] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-2 py-1 outline-none focus:border-[var(--foreground)]"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            {/* Remove */}
                            <button
                              onClick={() => removeItem(item.product.id)}
                              className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex-shrink-0 p-1"
                            >
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        {/* Price total */}
                        <div className="flex justify-between items-center pt-1 border-t border-[var(--border)]">
                          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)]">Total</span>
                          <span className="text-sm text-[var(--foreground)]">
                            ${priceMin}–${priceMax}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div>
                    <label className={labelCls}>Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Outfit name"
                      className={inputCls}
                    />
                  </div>

                  {/* Occasion + Season */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Occasion</label>
                      <select
                        value={form.occasion}
                        onChange={(e) => setForm((f) => ({ ...f, occasion: e.target.value as Occasion }))}
                        className={selectCls}
                      >
                        {OCCASIONS.map((o) => (
                          <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Season</label>
                      <select
                        value={form.season}
                        onChange={(e) => setForm((f) => ({ ...f, season: e.target.value as Season }))}
                        className={selectCls}
                      >
                        {SEASONS.map((s) => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Describe the outfit..."
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {/* Style keywords */}
                  <div>
                    <label className={labelCls}>Style keywords</label>
                    <div className="flex flex-wrap gap-1.5">
                      {STYLE_KEYWORDS.map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => toggleKeyword(kw)}
                          className={`text-[9px] uppercase tracking-[0.1em] px-2 py-1 border transition-colors ${
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

                  {/* Cover image upload */}
                  <div>
                    <label className={labelCls}>Cover image</label>

                    {/* Preview */}
                    {form.imageUrl ? (
                      <div className="relative mb-2 w-full aspect-[4/3] overflow-hidden bg-[var(--surface)]">
                        <Image
                          src={form.imageUrl}
                          alt="Cover preview"
                          fill
                          className="object-cover"
                          sizes="400px"
                          unoptimized={form.imageUrl.startsWith("blob:")}
                        />
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-[13px] leading-none"
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label className={`block cursor-pointer border border-dashed border-[var(--border)] hover:border-[var(--foreground)] transition-colors text-center py-8 mb-2 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(f);
                            e.target.value = "";
                          }}
                        />
                        <div className="flex flex-col items-center gap-1.5">
                          {uploading ? (
                            <span className="text-xs text-[var(--foreground-muted)]">Uploading…</span>
                          ) : (
                            <>
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[var(--foreground-subtle)]">
                                <path d="M10 3V14M10 3L6.5 6.5M10 3L13.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M3 17H17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                              </svg>
                              <span className="text-xs text-[var(--foreground-muted)]">Click to upload</span>
                              <span className="text-[10px] text-[var(--foreground-subtle)]">PNG, JPG, WEBP · max 10 MB</span>
                            </>
                          )}
                        </div>
                      </label>
                    )}

                    {uploadError && (
                      <p className="text-[10px] text-red-500 mb-1.5">{uploadError}</p>
                    )}

                    {/* Manual URL fallback */}
                    <input
                      type="url"
                      value={form.imageUrl}
                      onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                      placeholder="Or paste image URL…"
                      className={inputCls}
                    />
                  </div>

                  {/* AI Generated */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isAIGenerated"
                      checked={form.isAIGenerated}
                      onChange={(e) => setForm((f) => ({ ...f, isAIGenerated: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-[var(--foreground)]"
                    />
                    <label htmlFor="isAIGenerated" className="text-xs text-[var(--foreground-muted)] tracking-wide cursor-pointer">
                      AI generated outfit
                    </label>
                  </div>

                  {/* Error */}
                  {saveError && (
                    <p className="text-xs text-red-500">{saveError}</p>
                  )}
                </div>

                {/* Modal footer */}
                <div className="mt-auto px-5 py-4 border-t border-[var(--border)] flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={!form.name.trim() || saving}
                    className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-3 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : editingId ? "Save Changes" : "Create Outfit"}
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
          </div>
        </div>
      )}
    </div>
  );
}
