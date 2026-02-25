"use client";

import { useState } from "react";
import Image from "next/image";
import { products as initialProducts } from "@/lib/data/products";
import type { Product, Brand, Category } from "@/lib/types";

const BRANDS: Brand[] = [
  "Acne Studios",
  "Balenciaga",
  "Fear of God",
  "Toteme",
  "Lemaire",
  "The Row",
  "Jil Sander",
  "Maison Margiela",
  "A.P.C.",
  "Cos",
  "Arket",
  "Massimo Dutti",
  "Zara",
  "& Other Stories",
];

const CATEGORIES: Category[] = [
  "outerwear",
  "tops",
  "bottoms",
  "footwear",
  "accessories",
  "dresses",
  "knitwear",
];

interface ProductFormState {
  name: string;
  brand: Brand;
  category: Category;
  priceMin: string;
  priceMax: string;
  imageUrl: string;
  isNew: boolean;
}

const defaultForm: ProductFormState = {
  name: "",
  brand: "Toteme",
  category: "outerwear",
  priceMin: "",
  priceMax: "",
  imageUrl: "",
  isNew: false,
};

const inputClass =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";

const selectClass =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-[var(--background)] text-[var(--foreground)] transition-colors";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<ProductFormState>(defaultForm);

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
      priceMin: String(product.priceMin),
      priceMax: String(product.priceMax),
      imageUrl: product.imageUrl,
      isNew: product.isNew,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setForm(defaultForm);
  };

  const handleSave = () => {
    const priceMin = parseFloat(form.priceMin) || 0;
    const priceMax = parseFloat(form.priceMax) || priceMin;

    if (editingProduct) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name: form.name,
                brand: form.brand,
                category: form.category,
                priceMin,
                priceMax,
                imageUrl: form.imageUrl || p.imageUrl,
                isNew: form.isNew,
              }
            : p
        )
      );
    } else {
      const newProduct: Product = {
        id: `p-${Date.now()}`,
        name: form.name,
        brand: form.brand,
        category: form.category,
        description: "",
        imageUrl:
          form.imageUrl ||
          "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=800&q=90",
        images: [form.imageUrl || ""],
        colors: [],
        sizes: [],
        material: "",
        retailers: [],
        priceMin,
        priceMax,
        currency: "USD",
        isNew: form.isNew,
        isSaved: false,
        styleKeywords: ["minimal"],
      };
      setProducts((prev) => [newProduct, ...prev]);
    }

    closeModal();
  };

  const handleDelete = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">
            Products
          </h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
            {products.length} total &middot; {filtered.length} shown
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 text-xs tracking-[0.12em] uppercase transition-opacity hover:opacity-80"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1V11M1 6H11"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="search"
          placeholder="Search by name, brand or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputClass} max-w-sm`}
        />
      </div>

      {/* Table */}
      <div
        className="border border-[var(--border)] overflow-x-auto"
        style={{ background: "var(--background)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal w-16">
                Image
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                Name
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden md:table-cell">
                Brand
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden lg:table-cell">
                Category
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                Price
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden sm:table-cell">
                New
              </th>
              <th className="text-right px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]"
                >
                  No products found.
                </td>
              </tr>
            ) : (
              filtered.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="relative w-10 h-[52px] overflow-hidden flex-shrink-0">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">{product.name}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-[var(--foreground-muted)]">
                      {product.brand}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs tracking-[0.08em] uppercase text-[var(--foreground-subtle)]">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">
                      ${product.priceMin}
                      {product.priceMax !== product.priceMin && `–$${product.priceMax}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {product.isNew ? (
                      <span className="text-[9px] tracking-[0.14em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-1.5 py-0.5 leading-none">
                        New
                      </span>
                    ) : (
                      <span className="text-[var(--foreground-subtle)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Edit */}
                      <button
                        onClick={() => openEditModal(product)}
                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1"
                        aria-label="Edit product"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1"
                        aria-label="Delete product"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="border border-[var(--border)] p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--background)" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-7">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {editingProduct ? "Edit Product" : "Add Product"}
              </h2>
              <button
                onClick={closeModal}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 3L13 13M13 3L3 13"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Product name"
                  className={inputClass}
                />
              </div>

              {/* Brand */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
                  Brand
                </label>
                <select
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value as Brand }))}
                  className={selectClass}
                >
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as Category }))
                  }
                  className={selectClass}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
                    Price Min ($)
                  </label>
                  <input
                    type="number"
                    value={form.priceMin}
                    onChange={(e) => setForm((f) => ({ ...f, priceMin: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
                    Price Max ($)
                  </label>
                  <input
                    type="number"
                    value={form.priceMax}
                    onChange={(e) => setForm((f) => ({ ...f, priceMax: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
                  Image URL
                </label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>

              {/* Is New */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isNew"
                  checked={form.isNew}
                  onChange={(e) => setForm((f) => ({ ...f, isNew: e.target.checked }))}
                  className="w-3.5 h-3.5 accent-[var(--foreground)]"
                />
                <label
                  htmlFor="isNew"
                  className="text-xs text-[var(--foreground-muted)] tracking-wide cursor-pointer"
                >
                  Mark as new arrival
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-7">
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-3 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingProduct ? "Save Changes" : "Add Product"}
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
    </div>
  );
}
