"use client";

import { useState } from "react";
import Image from "next/image";
import { outfits as initialOutfits } from "@/lib/data/outfits";
import type { Outfit, Occasion } from "@/lib/types";

const OCCASIONS: Occasion[] = ["casual", "work", "evening", "sport", "formal", "weekend"];

interface OutfitFormState {
  name: string;
  occasion: Occasion;
  description: string;
  imageUrl: string;
  priceMin: string;
  priceMax: string;
  isAIGenerated: boolean;
}

const defaultForm: OutfitFormState = {
  name: "",
  occasion: "casual",
  description: "",
  imageUrl: "",
  priceMin: "",
  priceMax: "",
  isAIGenerated: false,
};

const inputClass =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";

const selectClass =
  "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-[var(--background)] text-[var(--foreground)] transition-colors";

export default function AdminOutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>(initialOutfits);
  const [showModal, setShowModal] = useState(false);
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<OutfitFormState>(defaultForm);

  const filtered = outfits.filter(
    (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.occasion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setEditingOutfit(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEditModal = (outfit: Outfit) => {
    setEditingOutfit(outfit);
    setForm({
      name: outfit.name,
      occasion: outfit.occasion,
      description: outfit.description,
      imageUrl: outfit.imageUrl,
      priceMin: String(outfit.totalPriceMin),
      priceMax: String(outfit.totalPriceMax),
      isAIGenerated: outfit.isAIGenerated,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingOutfit(null);
    setForm(defaultForm);
  };

  const handleSave = () => {
    const totalPriceMin = parseFloat(form.priceMin) || 0;
    const totalPriceMax = parseFloat(form.priceMax) || totalPriceMin;

    if (editingOutfit) {
      setOutfits((prev) =>
        prev.map((o) =>
          o.id === editingOutfit.id
            ? {
                ...o,
                name: form.name,
                occasion: form.occasion,
                description: form.description,
                imageUrl: form.imageUrl || o.imageUrl,
                totalPriceMin,
                totalPriceMax,
                isAIGenerated: form.isAIGenerated,
              }
            : o
        )
      );
    } else {
      const newOutfit: Outfit = {
        id: `o-${Date.now()}`,
        name: form.name,
        occasion: form.occasion,
        description: form.description,
        imageUrl:
          form.imageUrl ||
          "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=90",
        items: [],
        totalPriceMin,
        totalPriceMax,
        currency: "USD",
        styleKeywords: ["minimal"],
        isAIGenerated: form.isAIGenerated,
        isSaved: false,
        season: "all",
      };
      setOutfits((prev) => [newOutfit, ...prev]);
    }

    closeModal();
  };

  const handleDelete = (id: string) => {
    setOutfits((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">
            Outfits
          </h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
            {outfits.length} total &middot; {filtered.length} shown
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
                Occasion
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden lg:table-cell">
                Styles
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                Price Range
              </th>
              <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden sm:table-cell">
                AI
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
                  No outfits found.
                </td>
              </tr>
            ) : (
              filtered.map((outfit) => (
                <tr
                  key={outfit.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="relative w-10 h-[52px] overflow-hidden flex-shrink-0">
                      <Image
                        src={outfit.imageUrl}
                        alt={outfit.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">{outfit.name}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs tracking-[0.08em] uppercase text-[var(--foreground-muted)]">
                      {outfit.occasion}
                    </span>
                  </td>
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
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">
                      ${outfit.totalPriceMin}–${outfit.totalPriceMax}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {outfit.isAIGenerated ? (
                      <span className="text-[9px] tracking-[0.14em] uppercase bg-[var(--foreground)] text-[var(--background)] px-1.5 py-0.5 leading-none">
                        AI
                      </span>
                    ) : (
                      <span className="text-[var(--foreground-subtle)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Edit */}
                      <button
                        onClick={() => openEditModal(outfit)}
                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1"
                        aria-label="Edit outfit"
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
                        onClick={() => handleDelete(outfit.id)}
                        className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1"
                        aria-label="Delete outfit"
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
                {editingOutfit ? "Edit Outfit" : "Add Outfit"}
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
                  placeholder="Outfit name"
                  className={inputClass}
                />
              </div>

              {/* Occasion */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
                  Occasion
                </label>
                <select
                  value={form.occasion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, occasion: e.target.value as Occasion }))
                  }
                  className={selectClass}
                >
                  {OCCASIONS.map((o) => (
                    <option key={o} value={o}>
                      {o.charAt(0).toUpperCase() + o.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Outfit description..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
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

              {/* AI Generated */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isAIGenerated"
                  checked={form.isAIGenerated}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isAIGenerated: e.target.checked }))
                  }
                  className="w-3.5 h-3.5 accent-[var(--foreground)]"
                />
                <label
                  htmlFor="isAIGenerated"
                  className="text-xs text-[var(--foreground-muted)] tracking-wide cursor-pointer"
                >
                  AI generated outfit
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
                {editingOutfit ? "Save Changes" : "Add Outfit"}
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
